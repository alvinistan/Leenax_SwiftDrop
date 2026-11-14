package lk.swiftdrop.shipping;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
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
 * Shipping Phase C end to end: settings, country restrictions, rate cards,
 * platform fee, quotes and the audit log. Configuration is shared by all
 * tests, so each test restores what it changes or uses its own values.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@WithMockUser(username = "owner@example.com", roles = "ADMIN")
class ShippingIntegrationTest {

    private static final String ADMIN = "/api/admin/shipping";

    @Autowired
    private MockMvc mockMvc;

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
                        String json, int expectedStatus) throws Exception {
        return mockMvc.perform(request.with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
    }

    /** An ACTIVE product with one variant: 1.2 kg packed, 10×10×10 cm. Returns the variant id. */
    private String createProduct(String shippingCategory, String status) throws Exception {
        return createProduct("Rich cake", shippingCategory, status, "");
    }

    /** @param extraJson extra product fields, e.g. ", \"shippingDomesticOnly\": true" */
    private String createProduct(String name, String shippingCategory, String status, String extraJson)
            throws Exception {
        String category = JsonPath.read(send(post("/api/admin/categories"),
                "{\"name\": \"Shipping test\", \"slug\": \"" + unique("ship") + "\"}", 201), "$.id");
        String product = send(post("/api/admin/products"), """
                {"categoryId": "%s", "name": "%s", "slug": "%s", "status": "%s",
                 "shippingCategory": "%s"%s,
                 "variants": [{"sku": "%s", "price": 2500, "stockQuantity": 10,
                               "shippingWeightKg": 1.2, "lengthCm": 10, "widthCm": 10, "heightCm": 10}]}
                """.formatted(category, name, unique("cake"), status, shippingCategory, extraJson, unique("RC")), 201);
        return JsonPath.read(product, "$.variants[0].id");
    }

    private String dexStandardServiceId() throws Exception {
        String providers = mockMvc.perform(get(ADMIN + "/providers")).andReturn().getResponse().getContentAsString();
        List<String> ids = JsonPath.read(providers, "$[?(@.code == 'DEX')].services[0].id");
        return ids.get(0);
    }

    /** DEX → Sri Lanka: up to 1 kg 400, 2 kg 550, 5 kg 900 (test prices, not real DEX prices). */
    private void ensureDexLkRateCard() throws Exception {
        String cards = mockMvc.perform(get(ADMIN + "/rate-cards")).andReturn().getResponse().getContentAsString();
        List<String> existing = JsonPath.read(cards, "$[?(@.providerCode == 'DEX' && @.countryCode == 'LK')].id");
        if (existing.isEmpty()) {
            send(post(ADMIN + "/rate-cards"), """
                    {"serviceId": "%s", "countryCode": "LK", "enabled": true,
                     "bands": [{"maxWeightKg": 1, "price": 400}, {"maxWeightKg": 2, "price": 550},
                               {"maxWeightKg": 5, "price": 900}]}
                    """.formatted(dexStandardServiceId()), 201);
        }
    }

    private static String quoteJson(String country, String variantId, String quantity) {
        return """
                {"countryCode": "%s", "items": [{"variantId": "%s", "quantity": %s}]}
                """.formatted(country, variantId, quantity);
    }

    // ---------------------------------------------------------------

    @Test
    void settingsStartWithThePickupAddressAndChangesAreAudited() throws Exception {
        String original = mockMvc.perform(get(ADMIN + "/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.originCity").value("Jaffna"))
                .andExpect(jsonPath("$.originCountry").value("LK"))
                .andExpect(jsonPath("$.defaultPackagingKg").value("0.25")) // exact decimal string
                .andExpect(jsonPath("$.dutiesPaidBy").value("RECEIVER"))
                .andReturn().getResponse().getContentAsString();
        try {
            send(put(ADMIN + "/settings"), """
                    {"originLine1": "Sillalai South", "originLine2": "Pandatharippu", "originCity": "Jaffna",
                     "originPostalCode": "40000", "originCountry": "LK", "defaultPackagingKg": 0.3,
                     "dutiesPaidBy": "RECEIVER"}
                    """, 200);
            mockMvc.perform(get(ADMIN + "/audit").param("entityType", "SETTINGS"))
                    .andExpect(jsonPath("$.content[0].action").value("UPDATE"))
                    .andExpect(jsonPath("$.content[0].actor").value("owner@example.com"));
        } finally {
            send(put(ADMIN + "/settings"), original, 200);
        }
    }

    @Test
    void anUnknownOriginCountryIsRejected() throws Exception {
        send(put(ADMIN + "/settings"), """
                {"originLine1": "x", "originCity": "y", "originCountry": "XX", "defaultPackagingKg": 0.25,
                 "dutiesPaidBy": "RECEIVER"}
                """, 400);
    }

    @Test
    void domesticQuoteUsesTheRateCardAndThePlatformFee() throws Exception {
        ensureDexLkRateCard();
        String variant = createProduct("FOOD_PERISHABLE", "ACTIVE");

        // 1.2 kg + Small box (0.2 kg) = 1.4 kg → DEX rounds up to 2 kg → LKR 550; 2 % fee = 11.00
        mockMvc.perform(post(ADMIN + "/quotes/simulate").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(quoteJson("LK", variant, "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.domestic").value(true))
                .andExpect(jsonPath("$.parcel.actualWeightKg").value("1.4"))
                .andExpect(jsonPath("$.options[?(@.providerCode == 'DEX')].chargeableWeightKg").value(hasItem("2")))
                .andExpect(jsonPath("$.options[?(@.providerCode == 'DEX')].courierPrice.amount").value(hasItem("550.00")))
                .andExpect(jsonPath("$.options[?(@.providerCode == 'DEX')].platformFee.amount").value(hasItem("11.00")))
                .andExpect(jsonPath("$.options[?(@.providerCode == 'DEX')].customerPrice.amount").value(hasItem("561.00")));

        // The customer sees only the final price, and prices sent by the browser are ignored.
        String quote = mockMvc.perform(post("/api/shipping/quotes").with(anonymous()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"countryCode": "LK", "customerPrice": 1, "items": [
                                  {"variantId": "%s", "quantity": 1, "price": 1}]}
                                """.formatted(variant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.options[0].price.amount").value("561.00"))
                .andExpect(jsonPath("$.options[0].courierPrice").doesNotExist())
                .andExpect(jsonPath("$.options[0].platformFee").doesNotExist())
                .andExpect(jsonPath("$.expiresAt").exists())
                .andReturn().getResponse().getContentAsString();

        mockMvc.perform(get("/api/shipping/quotes/{id}", (String) JsonPath.read(quote, "$.quoteId")).with(anonymous()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.options[0].price.amount").value("561.00"))
                .andExpect(jsonPath("$.expired").value(false));
    }

    @Test
    void dhlIsNotQuotedUntilItsLiveRatesAreConnected() throws Exception {
        String variant = createProduct("FOOD_SHELF_STABLE", "ACTIVE");
        mockMvc.perform(post(ADMIN + "/quotes/simulate").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(quoteJson("GB", variant, "1")))
                .andExpect(jsonPath("$.domestic").value(false))
                .andExpect(jsonPath("$.problems").isEmpty())
                .andExpect(jsonPath("$.options[0].providerCode").value("DHL_EXPRESS"))
                .andExpect(jsonPath("$.options[0].available").value(false));

        // The customer gets a clear message, and no quote is saved.
        mockMvc.perform(post("/api/shipping/quotes").with(anonymous()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(quoteJson("GB", variant, "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quoteId").doesNotExist())
                .andExpect(jsonPath("$.options").isEmpty())
                .andExpect(jsonPath("$.problems[0]").exists());
    }

    @Test
    void perishableFoodCannotGoAbroad() throws Exception {
        String variant = createProduct("FOOD_PERISHABLE", "ACTIVE");
        mockMvc.perform(post(ADMIN + "/quotes/simulate").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(quoteJson("GB", variant, "1")))
                .andExpect(jsonPath("$.problems[0]").value("Rich cake cannot be shipped to United Kingdom."))
                .andExpect(jsonPath("$.items[0].problem").exists())
                .andExpect(jsonPath("$.options").isEmpty());
    }

    @Test
    void anAdminCanBlockOneCountryForOneCategory() throws Exception {
        String variant = createProduct("FOOD_SHELF_STABLE", "ACTIVE");
        String original = mockMvc.perform(get(ADMIN + "/category-policies")).andReturn().getResponse()
                .getContentAsString();
        boolean allowed = ((List<Boolean>) JsonPath.read(original,
                "$[?(@.category == 'FOOD_SHELF_STABLE')].internationalAllowed")).get(0);
        List<String> blocked = ((List<List<String>>) JsonPath.read(original,
                "$[?(@.category == 'FOOD_SHELF_STABLE')].blockedCountries")).get(0);
        try {
            send(put(ADMIN + "/category-policies/FOOD_SHELF_STABLE"),
                    "{\"internationalAllowed\": true, \"blockedCountries\": [\"AU\"]}", 200);

            mockMvc.perform(post(ADMIN + "/quotes/simulate").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content(quoteJson("AU", variant, "1")))
                    .andExpect(jsonPath("$.problems[0]").value("Rich cake cannot be shipped to Australia."));
            // Other countries are still allowed
            mockMvc.perform(post(ADMIN + "/quotes/simulate").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content(quoteJson("CA", variant, "1")))
                    .andExpect(jsonPath("$.problems").isEmpty());
            mockMvc.perform(get(ADMIN + "/audit").param("entityType", "COUNTRY_RESTRICTIONS"))
                    .andExpect(jsonPath("$.content[0].entityId").value("FOOD_SHELF_STABLE"));
        } finally {
            send(put(ADMIN + "/category-policies/FOOD_SHELF_STABLE"), """
                    {"internationalAllowed": %s, "blockedCountries": [%s]}
                    """.formatted(allowed, String.join(",", blocked.stream().map(c -> "\"" + c + "\"").toList())), 200);
        }
    }

    @Test
    void blockingAnUnknownCountryCodeIsRejected() throws Exception {
        send(put(ADMIN + "/category-policies/GENERAL"),
                "{\"internationalAllowed\": true, \"blockedCountries\": [\"ZZ\"]}", 400);
        send(put(ADMIN + "/category-policies/NOT_A_CATEGORY"),
                "{\"internationalAllowed\": true, \"blockedCountries\": []}", 400);
    }

    @Test
    void customersCannotQuoteDraftProductsButTheAdminSimulatorCan() throws Exception {
        String variant = createProduct("GENERAL", "DRAFT");
        mockMvc.perform(post("/api/shipping/quotes").with(anonymous()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(quoteJson("LK", variant, "1")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(ADMIN + "/quotes/simulate").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(quoteJson("LK", variant, "1")))
                .andExpect(status().isOk());
    }

    @Test
    void aQuantityTheProductDoesNotAllowIsRejected() throws Exception {
        String variant = createProduct("GENERAL", "ACTIVE");
        mockMvc.perform(post("/api/shipping/quotes").with(anonymous()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(quoteJson("LK", variant, "1.5")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void markupRulesAreValidatedAndAudited() throws Exception {
        // PERCENT without a percent
        send(post(ADMIN + "/markup-rules"), """
                {"name": "Broken", "type": "PERCENT", "enabled": true, "priority": 0}
                """, 400);
        // max below min
        send(post(ADMIN + "/markup-rules"), """
                {"name": "Broken", "type": "FIXED", "fixedAmount": 100, "minFee": 500, "maxFee": 100,
                 "enabled": true, "priority": 0}
                """, 400);

        String created = send(post(ADMIN + "/markup-rules"), """
                {"name": "Maldives promo", "type": "COMBINED", "percent": 1.5, "fixedAmount": 100,
                 "countryCode": "MV", "enabled": false, "priority": 0}
                """, 201);
        String id = JsonPath.read(created, "$.id");
        mockMvc.perform(get(ADMIN + "/markup-rules"))
                .andExpect(jsonPath("$[?(@.id == '" + id + "')].description").value(hasItem("1.5% + LKR 100 (Maldives promo)")));
        mockMvc.perform(delete(ADMIN + "/markup-rules/{id}", id).with(csrf())).andExpect(status().isNoContent());

        mockMvc.perform(get(ADMIN + "/audit").param("entityType", "MARKUP_RULE"))
                .andExpect(jsonPath("$.content[0].action").value("DELETE"))
                .andExpect(jsonPath("$.content[1].action").value("CREATE"))
                .andExpect(jsonPath("$.content[1].entityId").value(id));
    }

    @Test
    void rateCardBandsMustGoUpAndBeUniquePerServiceAndCountry() throws Exception {
        String service = dexStandardServiceId();
        send(post(ADMIN + "/rate-cards"), """
                {"serviceId": "%s", "countryCode": "LK", "enabled": true,
                 "bands": [{"maxWeightKg": 2, "price": 500}, {"maxWeightKg": 1, "price": 400}]}
                """.formatted(service), 400);
        ensureDexLkRateCard();
        send(post(ADMIN + "/rate-cards"), """
                {"serviceId": "%s", "countryCode": "LK", "enabled": true,
                 "bands": [{"maxWeightKg": 1, "price": 400}]}
                """.formatted(service), 409);
    }

    @Test
    void shippingAdministrationIsForAdminsOnly() throws Exception {
        mockMvc.perform(get(ADMIN + "/settings").with(anonymous())).andExpect(status().isUnauthorized());
        mockMvc.perform(get(ADMIN + "/settings").with(user("shopper@example.com").roles("CUSTOMER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(ADMIN + "/quotes/simulate").with(user("shopper@example.com").roles("CUSTOMER"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void aQuoteRequestWithoutCsrfTokenIsRefused() throws Exception {
        mockMvc.perform(post("/api/shipping/quotes").with(anonymous())
                        .contentType(MediaType.APPLICATION_JSON).content(quoteJson("LK", UUID.randomUUID().toString(), "1")))
                .andExpect(status().isForbidden());
    }

    @Test
    void oneProductCanBeRestrictedWithoutRestrictingItsWholeCategory() throws Exception {
        // Same category (shelf-stable food); only the dried fish is blocked for Australia.
        String driedFish = createProduct("Dried fish", "FOOD_SHELF_STABLE", "ACTIVE",
                ", \"shippingBlockedCountries\": [\"AU\"]");
        String richCake = createProduct("Rich cake", "FOOD_SHELF_STABLE", "ACTIVE", "");

        mockMvc.perform(post(ADMIN + "/quotes/simulate").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(quoteJson("AU", driedFish, "1")))
                .andExpect(jsonPath("$.problems[0]").value("Dried fish cannot be shipped to Australia."));
        mockMvc.perform(post(ADMIN + "/quotes/simulate").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(quoteJson("AU", richCake, "1")))
                .andExpect(jsonPath("$.problems").isEmpty());
        // Dried fish may still go to other countries
        mockMvc.perform(post(ADMIN + "/quotes/simulate").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(quoteJson("CA", driedFish, "1")))
                .andExpect(jsonPath("$.problems").isEmpty());

        mockMvc.perform(get(ADMIN + "/product-restrictions"))
                .andExpect(jsonPath("$[?(@.productName == 'Dried fish')].blockedCountries[0]").value(hasItem("AU")));
        mockMvc.perform(get(ADMIN + "/audit").param("entityType", "PRODUCT_RESTRICTIONS"))
                .andExpect(jsonPath("$.content[0].action").value("CREATE"))
                .andExpect(jsonPath("$.content[0].afterJson").value(org.hamcrest.Matchers.containsString("Dried fish")));
    }

    @Test
    void aProductCanBeSriLankaOnlyEvenIfItsCategoryGoesAbroad() throws Exception {
        String variant = createProduct("Fresh-style sweet", "GENERAL", "ACTIVE", ", \"shippingDomesticOnly\": true");
        mockMvc.perform(post(ADMIN + "/quotes/simulate").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(quoteJson("GB", variant, "1")))
                .andExpect(jsonPath("$.problems[0]").value("Fresh-style sweet cannot be shipped to United Kingdom."));
        mockMvc.perform(post(ADMIN + "/quotes/simulate").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(quoteJson("LK", variant, "1")))
                .andExpect(jsonPath("$.problems").isEmpty());
    }

    @Test
    void aProductCannotBlockAnUnknownCountry() throws Exception {
        String category = JsonPath.read(send(post("/api/admin/categories"),
                "{\"name\": \"x\", \"slug\": \"" + unique("x") + "\"}", 201), "$.id");
        send(post("/api/admin/products"), """
                {"categoryId": "%s", "name": "X", "slug": "%s", "status": "DRAFT",
                 "shippingBlockedCountries": ["ZZ"], "variants": [{"sku": "%s", "price": 1}]}
                """.formatted(category, unique("x"), unique("X")), 400);
    }
}
