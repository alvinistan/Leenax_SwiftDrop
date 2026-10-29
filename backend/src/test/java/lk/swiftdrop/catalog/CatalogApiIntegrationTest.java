package lk.swiftdrop.catalog;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
import org.springframework.test.web.servlet.MockMvc;

/**
 * End-to-end through every layer: HTTP → controller → service → JPA → PostgreSQL
 * (in Docker, via Testcontainers). Each test uses unique slugs and SKUs, so tests
 * do not depend on each other's data.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CatalogApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String createCategory(String slug, boolean active) throws Exception {
        String body = mockMvc.perform(post("/api/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Category %s", "slug": "%s", "active": %s}
                                """.formatted(slug, slug, active)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private String createProduct(String categoryId, String slug, String status, String sku) throws Exception {
        String body = mockMvc.perform(post("/api/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "categoryId": "%s",
                                  "name": "Cotton T-Shirt",
                                  "slug": "%s",
                                  "status": "%s",
                                  "variants": [
                                    {"sku": "%s-L", "price": 3100.00, "options": {"Size": "L", "Colour": "Red"}},
                                    {"sku": "%s-M", "price": 2900.50, "options": {"Size": "M", "Colour": "Red"}},
                                    {"sku": "%s-S", "price": 100.00, "options": {"Size": "S"}, "active": false}
                                  ]
                                }
                                """.formatted(categoryId, slug, status, sku, sku, sku)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/admin/products/")))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    @Test
    void activeProductIsVisibleWithItsActiveVariantsAndExactPrices() throws Exception {
        String category = unique("fashion");
        String slug = unique("t-shirt");
        createProduct(createCategory(category, true), slug, "ACTIVE", unique("SKU"));

        mockMvc.perform(get("/api/products/{slug}", slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category.slug").value(category))
                .andExpect(jsonPath("$.currency").value("LKR"))
                // the inactive "S" variant is hidden from customers
                .andExpect(jsonPath("$.variants.length()").value(2))
                .andExpect(jsonPath("$.variants[1].price.amount").value("2900.50"))
                .andExpect(jsonPath("$.variants[1].options.Size").value("M"));

        // the card price is the lowest ACTIVE variant (2900.50, not the inactive 100.00)
        mockMvc.perform(get("/api/products").param("category", category))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].fromPrice.amount").value("2900.50"));
    }

    @Test
    void draftProductsAndInactiveCategoriesAreHiddenFromCustomers() throws Exception {
        String activeCategory = createCategory(unique("home"), true);
        String draftSlug = unique("draft-mug");
        String draftId = createProduct(activeCategory, draftSlug, "DRAFT", unique("SKU"));

        String hiddenCategorySlug = unique("hidden");
        String hiddenProductSlug = unique("hidden-mug");
        createProduct(createCategory(hiddenCategorySlug, false), hiddenProductSlug, "ACTIVE", unique("SKU"));

        mockMvc.perform(get("/api/products/{slug}", draftSlug)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/products/{slug}", hiddenProductSlug)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/categories"))
                .andExpect(jsonPath("$[*].slug", not(hasItem(hiddenCategorySlug))));

        // ...but the admin can still see the draft, including inactive variants
        mockMvc.perform(get("/api/admin/products/{id}", draftId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.variants.length()").value(3));
    }

    @Test
    void duplicateSlugsAndSkusAreRejectedWith409() throws Exception {
        String category = createCategory(unique("electronics"), true);
        String slug = unique("earbuds");
        String sku = unique("SKU");
        createProduct(category, slug, "ACTIVE", sku);

        mockMvc.perform(post("/api/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Again", "slug": "%s"}
                                """.formatted(JsonPath.read(
                                        mockMvc.perform(get("/api/admin/categories/{id}", category))
                                                .andReturn().getResponse().getContentAsString(),
                                        "$.slug").toString())))
                .andExpect(status().isConflict());

        // same SKU as an existing product
        mockMvc.perform(post("/api/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Other", "slug": "%s", "status": "DRAFT",
                                 "variants": [{"sku": "%s-M", "price": 10}]}
                                """.formatted(category, unique("other"), sku)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail", containsString(sku + "-M")));
    }

    @Test
    void sameSkuTwiceInOneRequestIsAValidationError() throws Exception {
        String category = createCategory(unique("gifts"), true);

        mockMvc.perform(post("/api/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Box", "slug": "%s", "status": "DRAFT",
                                 "variants": [{"sku": "DUP-1", "price": 10}, {"sku": "DUP-1", "price": 12}]}
                                """.formatted(category, unique("box"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("variantSkusUnique"));
    }

    @Test
    void priceWithThreeDecimalsIsRejected() throws Exception {
        String category = createCategory(unique("health"), true);

        mockMvc.perform(post("/api/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Pills", "slug": "%s", "status": "DRAFT",
                                 "variants": [{"sku": "%s", "price": 10.999}]}
                                """.formatted(category, unique("pills"), unique("SKU"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("variants[0].price"));
    }

    @Test
    void cakeCanBeSoldAsFixedSizesAndByAnyWeight() throws Exception {
        String category = createCategory(unique("cakes"), true);
        String slug = unique("chocolate-cake");
        String sku = unique("CAKE");

        mockMvc.perform(post("/api/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Chocolate Cake", "slug": "%s", "status": "ACTIVE",
                                 "variants": [
                                   {"sku": "%s-1PC", "price": 1200, "options": {"Size": "1 piece"}},
                                   {"sku": "%s-1KG", "price": 4500, "options": {"Size": "1 kg"}},
                                   {"sku": "%s-BYKG", "price": 4200, "saleUnit": "KG",
                                    "minQuantity": 0.5, "maxQuantity": 5, "quantityStep": 0.5,
                                    "options": {"Size": "Custom weight"}}
                                 ]}
                                """.formatted(category, slug, sku, sku, sku)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/products/{slug}", slug))
                .andExpect(status().isOk())
                // fixed choices are sold by the piece
                .andExpect(jsonPath("$.variants[1].saleUnit").value("PIECE"))
                .andExpect(jsonPath("$.variants[1].quantity.min").value("1"))
                .andExpect(jsonPath("$.variants[1].quantity.step").value("1"))
                // any weight: price per kg and weight limits
                .andExpect(jsonPath("$.variants[2].saleUnit").value("KG"))
                .andExpect(jsonPath("$.variants[2].price.amount").value("4200.00"))
                .andExpect(jsonPath("$.variants[2].quantity.min").value("0.5"))
                .andExpect(jsonPath("$.variants[2].quantity.max").value("5"))
                .andExpect(jsonPath("$.variants[2].quantity.step").value("0.5"));

        mockMvc.perform(get("/api/products").param("category", JsonPath.read(
                                mockMvc.perform(get("/api/admin/categories/{id}", category))
                                        .andReturn().getResponse().getContentAsString(), "$.slug").toString()))
                .andExpect(jsonPath("$.content[0].fromPrice.amount").value("1200.00"))
                .andExpect(jsonPath("$.content[0].fromPriceUnit").value("PIECE"));
    }

    @Test
    void invalidQuantityRulesAreRejected() throws Exception {
        String category = createCategory(unique("bakery"), true);

        // half a piece is not allowed
        mockMvc.perform(post("/api/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Bun", "slug": "%s", "status": "DRAFT",
                                 "variants": [{"sku": "%s", "price": 80, "quantityStep": 0.5}]}
                                """.formatted(category, unique("bun"), unique("SKU"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("variants[0].quantityRulesValid"));

        // maximum below minimum
        mockMvc.perform(post("/api/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Cake", "slug": "%s", "status": "DRAFT",
                                 "variants": [{"sku": "%s", "price": 4000, "saleUnit": "KG",
                                               "minQuantity": 2, "maxQuantity": 1}]}
                                """.formatted(category, unique("cake"), unique("SKU"))))
                .andExpect(status().isBadRequest());

        // unknown sale unit (not PIECE or KG) → unreadable JSON → 400
        mockMvc.perform(post("/api/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "Rope", "slug": "%s", "status": "DRAFT",
                                 "variants": [{"sku": "%s", "price": 10, "saleUnit": "METRE"}]}
                                """.formatted(category, unique("rope"), unique("SKU"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void categoryWithProductsCannotBeDeletedButAnEmptyOneCan() throws Exception {
        String used = createCategory(unique("toys"), true);
        String productId = createProduct(used, unique("ball"), "ACTIVE", unique("SKU"));

        mockMvc.perform(delete("/api/admin/categories/{id}", used)).andExpect(status().isConflict());

        mockMvc.perform(delete("/api/admin/products/{id}", productId)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/admin/categories/{id}", used)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/admin/categories/{id}", used)).andExpect(status().isNotFound());
    }

    @Test
    void updateChangesTheProductAndCanHideIt() throws Exception {
        String category = createCategory(unique("books"), true);
        String slug = unique("notebook");
        String id = createProduct(category, slug, "ACTIVE", unique("SKU"));

        mockMvc.perform(put("/api/admin/products/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "name": "A5 Notebook", "slug": "%s", "status": "ARCHIVED"}
                                """.formatted(category, slug)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("A5 Notebook"))
                .andExpect(jsonPath("$.status").value("ARCHIVED"));

        mockMvc.perform(get("/api/products/{slug}", slug)).andExpect(status().isNotFound());
    }

    @Test
    void listingIsPaginatedAndRejectsUnknownSortFields() throws Exception {
        String categorySlug = unique("paging");
        String category = createCategory(categorySlug, true);
        for (int i = 0; i < 3; i++) {
            createProduct(category, unique("item"), "ACTIVE", unique("SKU"));
        }

        mockMvc.perform(get("/api/products").param("category", categorySlug).param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));

        mockMvc.perform(get("/api/products").param("sort", "doesNotExist"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Cannot sort by 'doesNotExist'. Allowed: createdAt, name."));

        // allowed sort fields work
        mockMvc.perform(get("/api/products").param("category", categorySlug).param("sort", "name,asc"))
                .andExpect(status().isOk());
    }
}
