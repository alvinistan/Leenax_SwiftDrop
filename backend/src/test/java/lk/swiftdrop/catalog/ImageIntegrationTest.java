package lk.swiftdrop.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Base64;
import java.util.UUID;
import lk.swiftdrop.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Image upload end to end: Spring → S3 (an S3Mock container) → pre-signed URL
 * → the real bytes come back. Runs as a logged-in ADMIN.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@WithMockUser(roles = "ADMIN")
class ImageIntegrationTest {

    /** A real 1×1 pixel PNG. */
    private static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

    @Autowired
    private MockMvc mockMvc;

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static MockMultipartFile file(byte[] content, String claimedName, String claimedType) {
        return new MockMultipartFile("file", claimedName, claimedType, content);
    }

    /** Downloads a URL like a browser's <img> would. */
    private static HttpResponse<byte[]> download(String url) throws Exception {
        return HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(url)).build(), HttpResponse.BodyHandlers.ofByteArray());
    }

    private String createCategory() throws Exception {
        String body = mockMvc.perform(post("/api/admin/categories").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Cakes\", \"slug\": \"" + unique("cakes") + "\"}"))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private String[] createProduct() throws Exception {
        String slug = unique("cake");
        String body = mockMvc.perform(post("/api/admin/products").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Cake", "slug": "%s", "status": "ACTIVE",
                                 "variants": [{"sku": "%s", "price": 100, "stockQuantity": 1}]}
                                """.formatted(createCategory(), slug, unique("SKU"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return new String[] {JsonPath.read(body, "$.id"), slug};
    }

    private String upload(String productId, byte[] content) throws Exception {
        return mockMvc.perform(multipart("/api/admin/products/{id}/images", productId)
                        .file(file(content, "photo.png", "image/png"))
                        .param("altText", "A chocolate cake")
                        .with(csrf()))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    void anUploadedPhotoIsStoredAndShownThroughAPreSignedLink() throws Exception {
        String[] product = createProduct();
        String uploaded = upload(product[0], PNG);

        String url = JsonPath.read(uploaded, "$.url");
        assertThat(url).contains("X-Amz-Signature=").contains("X-Amz-Expires=3600");
        // The stored key uses a random UUID, never the uploaded file name
        assertThat(url).doesNotContain("photo.png").contains("/products/" + product[0] + "/");

        HttpResponse<byte[]> image = download(url);
        assertThat(image.statusCode()).isEqualTo(200);
        assertThat(image.body()).isEqualTo(PNG);

        // Customers see it as the main photo
        mockMvc.perform(get("/api/products/{slug}", product[1]))
                .andExpect(jsonPath("$.images[0].altText").value("A chocolate cake"))
                .andExpect(jsonPath("$.images[0].url").isNotEmpty());
        mockMvc.perform(get("/api/admin/products/{id}", product[0]))
                .andExpect(jsonPath("$.images.length()").value(1));
    }

    @Test
    void onlyRealJpegPngOrWebpFilesAreAccepted() throws Exception {
        String productId = createProduct()[0];

        // A text file pretending to be a PNG (name and type are chosen by the uploader)
        mockMvc.perform(multipart("/api/admin/products/{id}/images", productId)
                        .file(file("<svg onload=alert(1)>".getBytes(), "cake.png", "image/png"))
                        .with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Upload a JPEG, PNG or WebP image."));

        mockMvc.perform(multipart("/api/admin/products/{id}/images", productId)
                        .file(file(new byte[0], "empty.png", "image/png"))
                        .with(csrf()))
                .andExpect(status().isBadRequest());
    }

    /**
     * MockMvc does not run the web server's own upload limit (Tomcat), so this
     * proves the application's own check. The server limit is checked over real HTTP.
     */
    @Test
    void filesOverFiveMegabytesAreRefusedWith413() throws Exception {
        byte[] big = new byte[6 * 1024 * 1024];
        System.arraycopy(PNG, 0, big, 0, PNG.length);

        mockMvc.perform(multipart("/api/admin/products/{id}/images", createProduct()[0])
                        .file(file(big, "big.png", "image/png"))
                        .with(csrf()))
                .andExpect(status().is(413));
    }

    @Test
    void aProductCanHaveAtMostTenPhotos() throws Exception {
        String productId = createProduct()[0];
        for (int i = 0; i < 10; i++) {
            upload(productId, PNG);
        }

        mockMvc.perform(multipart("/api/admin/products/{id}/images", productId)
                        .file(file(PNG, "eleventh.png", "image/png"))
                        .with(csrf()))
                .andExpect(status().isConflict());
    }

    @Test
    void deletingRemovesTheFileButOnlyThroughItsOwnProduct() throws Exception {
        String mine = createProduct()[0];
        String theirs = createProduct()[0];
        String uploaded = upload(theirs, PNG);
        String imageId = JsonPath.read(uploaded, "$.id");
        String url = JsonPath.read(uploaded, "$.url");

        // IDOR attempt: delete THEIR photo through MY product
        mockMvc.perform(delete("/api/admin/products/{p}/images/{i}", mine, imageId).with(csrf()))
                .andExpect(status().isNotFound());
        assertThat(download(url).statusCode()).isEqualTo(200);

        mockMvc.perform(delete("/api/admin/products/{p}/images/{i}", theirs, imageId).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(download(url).statusCode()).isEqualTo(404); // the file is gone from storage
    }

    @Test
    void deletingAProductRemovesItsPhotoFiles() throws Exception {
        String productId = createProduct()[0];
        String url = JsonPath.read(upload(productId, PNG), "$.url");

        mockMvc.perform(delete("/api/admin/products/{id}", productId).with(csrf()))
                .andExpect(status().isNoContent());

        assertThat(download(url).statusCode()).isEqualTo(404);
    }

    @Test
    void aCategoryPictureCanBeSetReplacedAndRemoved() throws Exception {
        String categoryId = createCategory();

        String first = mockMvc.perform(multipart(HttpMethod.PUT, "/api/admin/categories/{id}/image", categoryId)
                        .file(file(PNG, "cakes.png", "image/png"))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String firstUrl = JsonPath.read(first, "$.imageUrl");
        assertThat(download(firstUrl).statusCode()).isEqualTo(200);

        // Replacing it deletes the old file
        String second = mockMvc.perform(multipart(HttpMethod.PUT, "/api/admin/categories/{id}/image", categoryId)
                        .file(file(PNG, "cakes2.png", "image/png"))
                        .with(csrf()))
                .andReturn().getResponse().getContentAsString();
        assertThat(download(firstUrl).statusCode()).isEqualTo(404);
        String secondUrl = JsonPath.read(second, "$.imageUrl");

        mockMvc.perform(delete("/api/admin/categories/{id}/image", categoryId).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(download(secondUrl).statusCode()).isEqualTo(404);
        mockMvc.perform(get("/api/admin/categories/{id}", categoryId))
                .andExpect(jsonPath("$.imageUrl").doesNotExist());
    }
}
