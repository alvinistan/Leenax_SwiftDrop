package lk.swiftdrop.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Master Phase 8: customer sign-up, cart pricing, checkout and orders, end to
 * end against PostgreSQL. Each test uses its own products and customer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class OrderIntegrationTest {

    private static final RequestPostProcessor ADMIN = user("owner@example.com").roles("ADMIN");

    @Autowired
    private MockMvc mockMvc;

    private String customerEmail;
    private RequestPostProcessor customer;

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String send(MockHttpServletRequestBuilder request, RequestPostProcessor who, String json, int expected)
            throws Exception {
        return mockMvc.perform(request.with(who).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().is(expected))
                .andReturn().getResponse().getContentAsString();
    }

    private String read(MockHttpServletRequestBuilder request, RequestPostProcessor who) throws Exception {
        return mockMvc.perform(request.with(who)).andReturn().getResponse().getContentAsString();
    }

    @BeforeEach
    void registerCustomer() throws Exception {
        customerEmail = unique("buyer") + "@example.com";
        send(post("/api/auth/register"), anonymous(), """
                {"email": "%s", "password": "a-long-enough-password", "displayName": "Buyer"}
                """.formatted(customerEmail), 201);
        customer = user(customerEmail).roles("CUSTOMER");
        ensureDexLkRateCard();
    }

    /** DEX → Sri Lanka test prices: up to 1 kg 400, 2 kg 550, 5 kg 900, 10 kg 1500. */
    private void ensureDexLkRateCard() throws Exception {
        String cards = read(get("/api/admin/shipping/rate-cards"), ADMIN);
        List<String> existing = JsonPath.read(cards, "$[?(@.providerCode == 'DEX' && @.countryCode == 'LK')].id");
        if (existing.isEmpty()) {
            String providers = read(get("/api/admin/shipping/providers"), ADMIN);
            String service = ((List<String>) JsonPath.read(providers, "$[?(@.code == 'DEX')].services[0].id")).get(0);
            send(post("/api/admin/shipping/rate-cards"), ADMIN, """
                    {"serviceId": "%s", "countryCode": "LK", "enabled": true,
                     "bands": [{"maxWeightKg": 1, "price": 400}, {"maxWeightKg": 2, "price": 550},
                               {"maxWeightKg": 5, "price": 900}, {"maxWeightKg": 10, "price": 1500}]}
                    """.formatted(service), 201);
        }
    }

    private String taxRate(String percent) throws Exception {
        return JsonPath.read(send(post("/api/admin/tax-rates"), ADMIN,
                "{\"name\": \"" + unique("VAT") + "\", \"percent\": " + percent + "}", 201), "$.id");
    }

    /** Creates an ACTIVE product (one variant, 0.5 kg packed); returns the product JSON. */
    private String product(String price, String stock, boolean codAllowed, String taxRateId) throws Exception {
        String category = JsonPath.read(send(post("/api/admin/categories"), ADMIN,
                "{\"name\": \"Sweets\", \"slug\": \"" + unique("sweets") + "\"}", 201), "$.id");
        return send(post("/api/admin/products"), ADMIN, """
                {"categoryId": "%s", "name": "Milk toffee", "slug": "%s", "status": "ACTIVE",
                 "codAllowed": %s, "taxRateId": %s,
                 "variants": [{"sku": "%s", "price": %s, "stockQuantity": %s, "options": {"Pack": "250 g"},
                               "shippingWeightKg": 0.5}]}
                """.formatted(category, unique("toffee"), codAllowed,
                taxRateId == null ? "null" : "\"" + taxRateId + "\"", unique("MT"), price, stock), 201);
    }

    private static String variantId(String productJson) {
        return JsonPath.read(productJson, "$.variants[0].id");
    }

    private String stockOf(String productJson) throws Exception {
        return JsonPath.read(read(get("/api/admin/products/{id}", (String) JsonPath.read(productJson, "$.id")), ADMIN),
                "$.variants[0].stockQuantity");
    }

    /** A saved quote for these items to Sri Lanka; returns the DEX option id. */
    private String quoteOption(String itemsJson) throws Exception {
        String quote = send(post("/api/shipping/quotes"), anonymous(),
                "{\"countryCode\": \"LK\", \"items\": " + itemsJson + "}", 200);
        List<String> options = JsonPath.read(quote, "$.options[*].optionId");
        assertThat(options).as("delivery options: " + quote).isNotEmpty();
        return options.get(0);
    }

    private static String orderJson(String itemsJson, String optionId, String paymentMethod) {
        return """
                {"items": %s, "quoteOptionId": "%s", "paymentMethod": "%s",
                 "address": {"recipientName": "Kamala", "phone": "+94 77 123 4567", "line1": "12 Temple Road",
                             "city": "Jaffna", "postalCode": "40000", "countryCode": "LK"}}
                """.formatted(itemsJson, optionId, paymentMethod);
    }

    private String place(String json, String key, int expected) throws Exception {
        return mockMvc.perform(post("/api/orders").with(customer).with(csrf()).header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().is(expected))
                .andReturn().getResponse().getContentAsString();
    }

    // ---------------------------------------------------------------

    @Test
    void customersSignUpThemselvesButNeverAsAdmins() throws Exception {
        mockMvc.perform(get("/api/auth/me").with(customer)).andExpect(status().isOk());
        // Same email again
        send(post("/api/auth/register"), anonymous(), """
                {"email": "%s", "password": "a-long-enough-password", "displayName": "Again"}
                """.formatted(customerEmail.toUpperCase()), 409);
        // Weak password
        send(post("/api/auth/register"), anonymous(), """
                {"email": "%s", "password": "short", "displayName": "X"}
                """.formatted(unique("x") + "@example.com"), 400);
        // A "roles" field is ignored: the account is a customer
        String body = send(post("/api/auth/register"), anonymous(), """
                {"email": "%s", "password": "a-long-enough-password", "displayName": "Sneaky", "roles": ["ADMIN"]}
                """.formatted(unique("sneaky") + "@example.com"), 201);
        assertThat((List<String>) JsonPath.read(body, "$.roles")).containsExactly("CUSTOMER");
    }

    @Test
    void theCartIsPricedFromTheDatabaseWithTaxIncluded() throws Exception {
        String p = product("1180", "5", false, taxRate("18"));
        String cart = send(post("/api/cart/price"), anonymous(), """
                {"items": [{"variantId": "%s", "quantity": 2, "price": 1},
                           {"variantId": "%s", "quantity": 1}]}
                """.formatted(variantId(p), UUID.randomUUID()), 200);
        assertThat((String) JsonPath.read(cart, "$.lines[0].lineTotal.amount")).isEqualTo("2360.00");
        assertThat((String) JsonPath.read(cart, "$.lines[0].taxIncluded.amount")).isEqualTo("360.00"); // 2360 × 18/118
        assertThat((String) JsonPath.read(cart, "$.lines[0].variantLabel")).isEqualTo("250 g");
        assertThat((String) JsonPath.read(cart, "$.lines[1].problem")).isEqualTo("This item is no longer available.");
        assertThat((Boolean) JsonPath.read(cart, "$.orderable")).isFalse();
        assertThat((String) JsonPath.read(cart, "$.itemsTotal.amount")).isEqualTo("2360.00");

        String tooMany = send(post("/api/cart/price"), anonymous(),
                "{\"items\": [{\"variantId\": \"%s\", \"quantity\": 6}]}".formatted(variantId(p)), 200);
        assertThat((String) JsonPath.read(tooMany, "$.lines[0].problem")).isEqualTo("Only a smaller quantity is in stock.");
    }

    @Test
    void placesACashOnDeliveryOrderWithSnapshotsAndTakesTheStock() throws Exception {
        String p = product("1180", "10", true, taxRate("18"));
        String items = "[{\"variantId\": \"%s\", \"quantity\": 2}]".formatted(variantId(p));
        String option = quoteOption(items);
        String key = UUID.randomUUID().toString();

        String order = place(orderJson(items, option, "COD"), key, 201);
        String number = JsonPath.read(order, "$.orderNumber");
        assertThat(number).matches("SD-\\d{6}");
        assertThat((String) JsonPath.read(order, "$.status")).isEqualTo("PLACED");
        assertThat((String) JsonPath.read(order, "$.paymentMethod")).isEqualTo("COD");
        assertThat((String) JsonPath.read(order, "$.itemsTotal.amount")).isEqualTo("2360.00");
        assertThat((String) JsonPath.read(order, "$.taxIncluded.amount")).isEqualTo("360.00");
        // 2 × 0.5 kg + Small box 0.2 kg = 1.2 kg → DEX 2 kg band 550 + 2 % = 561
        assertThat((String) JsonPath.read(order, "$.shippingPrice.amount")).isEqualTo("561.00");
        assertThat((String) JsonPath.read(order, "$.grandTotal.amount")).isEqualTo("2921.00");
        // The customer never sees the courier cost or the fee
        assertThat(order).doesNotContain("courierPrice").doesNotContain("platformFee");
        assertThat(stockOf(p)).isEqualTo("8");

        // Double submit with the same key: the same order, nothing taken twice
        String again = place(orderJson(items, option, "COD"), key, 200);
        assertThat((String) JsonPath.read(again, "$.orderNumber")).isEqualTo(number);
        assertThat(stockOf(p)).isEqualTo("8");

        // The admin sees the delivery cost breakdown and the customer
        String admin = read(get("/api/admin/orders/{n}", number), ADMIN);
        assertThat((String) JsonPath.read(admin, "$.shipping.courierPrice.amount")).isEqualTo("550.00");
        assertThat((String) JsonPath.read(admin, "$.shipping.platformFee.amount")).isEqualTo("11.00");
        assertThat((String) JsonPath.read(admin, "$.customerEmail")).isEqualTo(customerEmail);
    }

    @Test
    void cashOnDeliveryNeedsEveryProductToAllowIt() throws Exception {
        String codOk = product("500", "5", true, null);
        String noCod = product("700", "5", false, null);
        String items = "[{\"variantId\": \"%s\", \"quantity\": 1}, {\"variantId\": \"%s\", \"quantity\": 1}]"
                .formatted(variantId(codOk), variantId(noCod));
        String option = quoteOption(items);

        send(post("/api/orders").header("Idempotency-Key", UUID.randomUUID().toString()), customer,
                orderJson(items, option, "COD"), 400);
        // Arranging payment later always works
        place(orderJson(items, option, "ARRANGE_LATER"), UUID.randomUUID().toString(), 201);
    }

    @Test
    void ifAnyItemIsShortNothingIsTaken() throws Exception {
        String plenty = product("500", "5", false, null);
        String last = product("500", "1", false, null);
        String items = "[{\"variantId\": \"%s\", \"quantity\": 2}, {\"variantId\": \"%s\", \"quantity\": 2}]"
                .formatted(variantId(plenty), variantId(last));
        String option = quoteOption(items);

        String body = place(orderJson(items, option, "ARRANGE_LATER"), UUID.randomUUID().toString(), 409);
        assertThat(body).contains("not enough stock");
        assertThat(stockOf(plenty)).isEqualTo("5"); // rolled back
        assertThat(stockOf(last)).isEqualTo("1");
    }

    @Test
    void aChangedDeliveryPriceMustBeConfirmedAgain() throws Exception {
        String p = product("500", "5", false, null);
        String items = "[{\"variantId\": \"%s\", \"quantity\": 1}]".formatted(variantId(p));
        String option = quoteOption(items); // 0.5 + 0.2 = 0.7 kg → 1 kg band (400)

        // The admin corrects the packed weight: now 3 kg → 5 kg band (900)
        String id = JsonPath.read(p, "$.id");
        send(put("/api/admin/products/{id}", id), ADMIN, """
                {"categoryId": "%s", "name": "Milk toffee", "slug": "%s", "status": "ACTIVE",
                 "variants": [{"id": "%s", "sku": "%s", "price": 500, "stockQuantity": 5, "shippingWeightKg": 3}]}
                """.formatted(JsonPath.read(p, "$.category.id"), JsonPath.read(p, "$.slug"), variantId(p),
                JsonPath.read(p, "$.variants[0].sku")), 200);

        String body = place(orderJson(items, option, "ARRANGE_LATER"), UUID.randomUUID().toString(), 409);
        assertThat(body).contains("delivery price has changed");
        assertThat(stockOf(p)).isEqualTo("5");
    }

    @Test
    void customersSeeOnlyTheirOwnOrdersAndCanCancelBeforeConfirmation() throws Exception {
        String p = product("500", "5", false, null);
        String items = "[{\"variantId\": \"%s\", \"quantity\": 1}]".formatted(variantId(p));
        String number = JsonPath.read(place(orderJson(items, quoteOption(items), "ARRANGE_LATER"),
                UUID.randomUUID().toString(), 201), "$.orderNumber");

        mockMvc.perform(get("/api/orders").with(customer))
                .andExpect(jsonPath("$.content[0].orderNumber").value(number));
        // Another customer: 404 (not 403), so order numbers cannot be probed
        mockMvc.perform(get("/api/orders/{n}", number).with(user("someone-else@example.com").roles("CUSTOMER")))
                .andExpect(status().isNotFound());
        // Customers cannot use the admin order API
        mockMvc.perform(get("/api/admin/orders").with(customer)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/orders").with(anonymous())).andExpect(status().isUnauthorized());

        assertThat(stockOf(p)).isEqualTo("4");
        send(post("/api/orders/{n}/cancel", number), customer, "{}", 200);
        assertThat(stockOf(p)).isEqualTo("5"); // stock returned
        send(post("/api/orders/{n}/cancel", number), customer, "{}", 400); // already cancelled
    }

    @Test
    void theOwnerMovesAnOrderStepByStepAndRecordsPayment() throws Exception {
        String p = product("500", "5", false, null);
        String items = "[{\"variantId\": \"%s\", \"quantity\": 1}]".formatted(variantId(p));
        String number = JsonPath.read(place(orderJson(items, quoteOption(items), "ARRANGE_LATER"),
                UUID.randomUUID().toString(), 201), "$.orderNumber");

        send(post("/api/admin/orders/{n}/status", number), ADMIN, "{\"status\": \"SHIPPED\"}", 400); // skips a step
        send(post("/api/admin/orders/{n}/payment", number), ADMIN, "{\"note\": \"Bank transfer received\"}", 200);
        send(post("/api/admin/orders/{n}/status", number), ADMIN, "{\"status\": \"CONFIRMED\"}", 200);
        send(post("/api/admin/orders/{n}/status", number), ADMIN, "{\"status\": \"SHIPPED\", \"note\": \"DEX AWB DX1\"}", 200);
        String done = send(post("/api/admin/orders/{n}/status", number), ADMIN, "{\"status\": \"DELIVERED\"}", 200);
        assertThat((String) JsonPath.read(done, "$.paymentStatus")).isEqualTo("PAID");
        assertThat((List<String>) JsonPath.read(done, "$.history[*].status"))
                .containsExactly("PLACED", "PAID", "CONFIRMED", "SHIPPED", "DELIVERED");
        assertThat((List<String>) JsonPath.read(done, "$.allowedNextStatuses")).isEmpty();

        // The customer sees the history without staff names
        String mine = read(get("/api/orders/{n}", number), customer);
        assertThat((List<Object>) JsonPath.read(mine, "$.history[*].actor")).containsOnlyNulls();
        mockMvc.perform(get("/api/admin/orders").param("q", number.toLowerCase()).with(ADMIN))
                .andExpect(jsonPath("$.content[0].orderNumber").value(number));
    }

    @Test
    void onlyChosenCountriesGetDeliveryPrices() throws Exception {
        String p = product("500", "5", false, null);
        String quote = send(post("/api/shipping/quotes"), anonymous(),
                "{\"countryCode\": \"BR\", \"items\": [{\"variantId\": \"%s\", \"quantity\": 1}]}".formatted(variantId(p)),
                200);
        assertThat((String) JsonPath.read(quote, "$.problems[0]")).isEqualTo("We don't deliver to Brazil yet.");

        String countries = read(get("/api/shipping/destinations"), anonymous());
        assertThat((List<String>) JsonPath.read(countries, "$[*].code")).contains("LK", "IN", "CA", "GB").doesNotContain("BR");
    }

    @Test
    void anOrderNeedsAnIdempotencyKeyAndAValidAddress() throws Exception {
        String p = product("500", "5", false, null);
        String items = "[{\"variantId\": \"%s\", \"quantity\": 1}]".formatted(variantId(p));
        String option = quoteOption(items);
        send(post("/api/orders"), customer, orderJson(items, option, "ARRANGE_LATER"), 400); // no key
        send(post("/api/orders").header("Idempotency-Key", UUID.randomUUID().toString()), customer,
                orderJson(items, option, "ARRANGE_LATER").replace("+94 77 123 4567", "call me"), 400);
    }

    @Test
    void taxRatesInUseCannotBeDeleted() throws Exception {
        String rate = taxRate("18");
        product("1180", "5", false, rate);
        send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/admin/tax-rates/{id}", rate),
                ADMIN, "", 409);
    }
}
