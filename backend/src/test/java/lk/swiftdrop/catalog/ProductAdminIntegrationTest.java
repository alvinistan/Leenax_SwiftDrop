package lk.swiftdrop.catalog;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import lk.swiftdrop.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Admin product management (Phase 6B): editing variants in one request,
 * stock, and the admin search. Runs as a logged-in ADMIN. Every test uses
 * unique slugs and SKUs, so tests do not depend on each other's data.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@WithMockUser(roles = "ADMIN")
class ProductAdminIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String createCategory() throws Exception {
        String slug = unique("cat");
        String body = mockMvc.perform(post("/api/admin/categories").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Category\", \"slug\": \"" + slug + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    /** POSTs a product and returns the response JSON. */
    private String createProduct(String json) throws Exception {
        return mockMvc.perform(post("/api/admin/products").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    void oneUpdateCanChangeAddAndRemoveVariants() throws Exception {
        String category = createCategory();
        String slug = unique("shirt");
        String sku = unique("SH");
        String created = createProduct("""
                {"categoryId": "%s", "name": "Shirt", "slug": "%s", "status": "ACTIVE",
                 "variants": [
                   {"sku": "%s-L", "price": 3000, "options": {"Size": "L"}, "stockQuantity": 4},
                   {"sku": "%s-M", "price": 2900, "options": {"Size": "M"}, "stockQuantity": 0}
                 ]}
                """.formatted(category, slug, sku, sku));
        String id = JsonPath.read(created, "$.id");
        String mediumId = JsonPath.read(created, "$.variants[1].id");

        // Keep M (new price and stock), remove L, add XL that REUSES L's old SKU.
        mockMvc.perform(put("/api/admin/products/{id}", id).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Shirt", "slug": "%s", "status": "ACTIVE",
                                 "variants": [
                                   {"id": "%s", "sku": "%s-M", "price": 2950, "options": {"Size": "M"}, "stockQuantity": 7},
                                   {"sku": "%s-L", "price": 3200, "options": {"Size": "XL"}, "stockQuantity": 2}
                                 ]}
                                """.formatted(category, slug, mediumId, sku, sku)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.variants[*].options.Size", contains("M", "XL")))
                .andExpect(jsonPath("$.variants[0].id").value(mediumId)) // same variant, updated
                .andExpect(jsonPath("$.variants[0].price.amount").value("2950.00"))
                .andExpect(jsonPath("$.variants[0].stockQuantity").value("7"));

        mockMvc.perform(get("/api/products/{slug}", slug))
                .andExpect(jsonPath("$.variants.length()").value(2));
    }

    @Test
    void aVariantOfAnotherProductCannotBeEditedThroughThisOne() throws Exception {
        String category = createCategory();
        String mine = createProduct(productJson(category, unique("mine"), unique("MINE")));
        String theirs = createProduct(productJson(category, unique("theirs"), unique("THEIRS")));
        String theirVariantId = JsonPath.read(theirs, "$.variants[0].id");
        String theirVariantSku = JsonPath.read(theirs, "$.variants[0].sku");

        // Attack: put THEIR variant id into MY product update ("IDOR").
        mockMvc.perform(put("/api/admin/products/{id}", (String) JsonPath.read(mine, "$.id")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Mine", "slug": "%s", "status": "DRAFT",
                                 "variants": [{"id": "%s", "sku": "HIJACKED", "price": 1}]}
                                """.formatted(category, JsonPath.read(mine, "$.slug"), theirVariantId)))
                .andExpect(status().isNotFound());

        // Their variant is untouched
        mockMvc.perform(get("/api/admin/products/{id}", (String) JsonPath.read(theirs, "$.id")))
                .andExpect(jsonPath("$.variants[0].sku").value(theirVariantSku));
    }

    @Test
    void customersSeeOnlyInStockOrNotNeverTheExactStock() throws Exception {
        String category = createCategory();
        String slug = unique("cake");
        createProduct("""
                {"categoryId": "%s", "name": "Cake", "slug": "%s", "status": "ACTIVE",
                 "variants": [
                   {"sku": "%s", "price": 1200, "options": {"Size": "1 piece"}, "stockQuantity": 0},
                   {"sku": "%s", "price": 4200, "saleUnit": "KG", "minQuantity": 0.5, "quantityStep": 0.5,
                    "options": {"Size": "By weight"}, "stockQuantity": 0.25}
                 ]}
                """.formatted(category, slug, unique("PC"), unique("KG")));

        mockMvc.perform(get("/api/products/{slug}", slug))
                .andExpect(jsonPath("$.variants[0].inStock").value(false))
                // 0.25 kg is less than the 0.5 kg minimum order → not buyable
                .andExpect(jsonPath("$.variants[1].inStock").value(false))
                .andExpect(jsonPath("$.variants[0].stockQuantity").doesNotExist());
    }

    @Test
    void pricesAndQuantitiesMayBeSentAsStringsForExactness() throws Exception {
        // The admin form sends "2900.50" (a string) so JavaScript never rounds it.
        String created = createProduct("""
                {"categoryId": "%s", "name": "Rice", "slug": "%s", "status": "DRAFT",
                 "variants": [{"sku": "%s", "price": "2900.50", "saleUnit": "KG",
                               "minQuantity": "1", "quantityStep": "0.5", "stockQuantity": "12.750"}]}
                """.formatted(createCategory(), unique("rice"), unique("RICE")));

        mockMvc.perform(get("/api/admin/products/{id}", (String) JsonPath.read(created, "$.id")))
                .andExpect(jsonPath("$.variants[0].price.amount").value("2900.50"))
                .andExpect(jsonPath("$.variants[0].stockQuantity").value("12.75"));
    }

    @Test
    void stockRulesAreValidated() throws Exception {
        String category = createCategory();

        // half a piece in stock is impossible
        mockMvc.perform(post("/api/admin/products").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Mug", "slug": "%s", "status": "DRAFT",
                                 "variants": [{"sku": "%s", "price": 100, "stockQuantity": 2.5}]}
                                """.formatted(category, unique("mug"), unique("MUG"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("variants[0].quantityRulesValid"));

        // an ACTIVE product whose variants are all inactive could never be bought
        mockMvc.perform(post("/api/admin/products").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Mug", "slug": "%s", "status": "ACTIVE",
                                 "variants": [{"sku": "%s", "price": 100, "active": false}]}
                                """.formatted(category, unique("mug"), unique("MUG"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("activeProductHasActiveVariant"));
    }

    @Test
    void adminCanSearchByNameAndFilterByStatus() throws Exception {
        String category = createCategory();
        String tag = UUID.randomUUID().toString().substring(0, 6);
        createProduct(productJson(category, unique("p"), unique("A"), "Gift Box " + tag, "ACTIVE"));
        createProduct(productJson(category, unique("p"), unique("B"), "Gift Card 100% " + tag, "DRAFT"));
        createProduct(productJson(category, unique("p"), unique("C"), "Gift Card 1000 " + tag, "DRAFT"));

        mockMvc.perform(get("/api/admin/products").param("q", "gift " + tag))
                .andExpect(jsonPath("$.totalElements").value(0)); // words must be adjacent
        mockMvc.perform(get("/api/admin/products").param("q", "GIFT").param("status", "DRAFT").param("size", "100"))
                .andExpect(jsonPath("$.content[*].name",
                        org.hamcrest.Matchers.hasItems("Gift Card 100% " + tag, "Gift Card 1000 " + tag)));
        // "%" is searched literally, not as a wildcard
        mockMvc.perform(get("/api/admin/products").param("q", "100% " + tag))
                .andExpect(jsonPath("$.content[*].name", containsInAnyOrder("Gift Card 100% " + tag)));
    }

    private static String productJson(String category, String slug, String sku) {
        return productJson(category, slug, sku, "Product", "DRAFT");
    }

    private static String productJson(String category, String slug, String sku, String name, String status) {
        return """
                {"categoryId": "%s", "name": "%s", "slug": "%s", "status": "%s",
                 "variants": [{"sku": "%s", "price": 100, "stockQuantity": 1}]}
                """.formatted(category, name, slug, status, sku);
    }
}
