package lk.swiftdrop.shipping;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.TestcontainersConfiguration;
import lk.swiftdrop.shipping.quote.QuoteCleanupJob;
import lk.swiftdrop.store.StoreDefaults;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Shipping Phase F: shipments linked to orders, status sync, customer tracking, expenses, quote clean-up. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ShipmentOrderIntegrationTest {

    private static final RequestPostProcessor ADMIN = user("owner@example.com").roles("ADMIN");
    private static final String SHIPMENTS = "/api/admin/shipping/shipments";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private QuoteCleanupJob cleanup;

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

    private String read(String path, RequestPostProcessor who, Object... vars) throws Exception {
        return mockMvc.perform(get(path, vars).with(who)).andReturn().getResponse().getContentAsString();
    }

    @BeforeEach
    void setUp() throws Exception {
        String email = unique("buyer") + "@example.com";
        send(post("/api/auth/register"), anonymous(),
                "{\"email\": \"%s\", \"password\": \"a-long-enough-password\", \"displayName\": \"Buyer\"}".formatted(email),
                201);
        customer = user(email).roles("CUSTOMER");
        String cards = read("/api/admin/shipping/rate-cards", ADMIN);
        if (((List<?>) JsonPath.read(cards, "$[?(@.providerCode == 'DEX' && @.countryCode == 'LK')]")).isEmpty()) {
            send(post("/api/admin/shipping/rate-cards"), ADMIN, """
                    {"serviceId": "%s", "countryCode": "LK", "enabled": true,
                     "bands": [{"maxWeightKg": 1, "price": 400}, {"maxWeightKg": 2, "price": 550},
                               {"maxWeightKg": 5, "price": 900}, {"maxWeightKg": 10, "price": 1500}]}
                    """.formatted(dexServiceId()), 201);
        }
    }

    private String dexId() throws Exception {
        return ((List<String>) JsonPath.read(read("/api/admin/shipping/providers", ADMIN), "$[?(@.code == 'DEX')].id")).get(0);
    }

    private String dexServiceId() throws Exception {
        return ((List<String>) JsonPath.read(read("/api/admin/shipping/providers", ADMIN),
                "$[?(@.code == 'DEX')].services[0].id")).get(0);
    }

    /** A placed order: 2 × 0.5 kg → delivery LKR 561. Returns the order number. */
    private String placeOrder() throws Exception {
        String category = JsonPath.read(send(post("/api/admin/categories"), ADMIN,
                "{\"name\": \"C\", \"slug\": \"" + unique("c") + "\"}", 201), "$.id");
        String product = send(post("/api/admin/products"), ADMIN, """
                {"categoryId": "%s", "name": "Toffee", "slug": "%s", "status": "ACTIVE",
                 "variants": [{"sku": "%s", "price": 500, "stockQuantity": 10, "shippingWeightKg": 0.5}]}
                """.formatted(category, unique("t"), unique("T")), 201);
        String items = "[{\"variantId\": \"%s\", \"quantity\": 2}]".formatted((String) JsonPath.read(product, "$.variants[0].id"));
        String quote = send(post("/api/shipping/quotes"), anonymous(), "{\"countryCode\": \"LK\", \"items\": " + items + "}", 200);
        String option = JsonPath.read(quote, "$.options[0].optionId");
        String order = mockMvc.perform(post("/api/orders").with(customer).with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"items": %s, "quoteOptionId": "%s", "paymentMethod": "ARRANGE_LATER",
                                 "address": {"recipientName": "Kamala", "phone": "+94 77 123 4567",
                                             "line1": "12 Temple Road", "city": "Jaffna", "countryCode": "LK"}}
                                """.formatted(items, option)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(order, "$.orderNumber");
    }

    private String shipmentJson(String orderNumber, String country, String cost) throws Exception {
        return """
                {"providerId": "%s", "orderNumber": %s,
                 "details": {"orderReference": "ignored", "awb": "%s", "destinationCountry": "%s",
                             "destinationCity": "Jaffna", "courierCost": %s}}
                """.formatted(dexId(), orderNumber == null ? "null" : "\"" + orderNumber + "\"",
                ("DX" + UUID.randomUUID().toString().replace("-", "").substring(0, 10)).toUpperCase(), country, cost);
    }

    private void track(String shipmentId, String status) throws Exception {
        send(post(SHIPMENTS + "/{id}/tracking", shipmentId), ADMIN,
                "{\"status\": \"" + status + "\", \"location\": \"Jaffna\", \"note\": \"internal note\"}", 200);
    }

    // ---------------------------------------------------------------

    @Test
    void anOrderIsShippedOnlyAfterConfirmationAndFollowsItsParcel() throws Exception {
        String number = placeOrder();
        // Not confirmed yet: no booking just because an order was placed
        String refused = send(post(SHIPMENTS), ADMIN, shipmentJson(number, "LK", "550"), 400);
        assertThat(refused).contains("Confirm it before shipping");

        send(post("/api/admin/orders/{n}/status", number), ADMIN, "{\"status\": \"CONFIRMED\"}", 200);
        send(post(SHIPMENTS), ADMIN, shipmentJson(number, "IN", "550"), 400); // wrong country
        String shipment = send(post(SHIPMENTS), ADMIN, shipmentJson(number, "LK", "550"), 201);
        String id = JsonPath.read(shipment, "$.id");
        assertThat((String) JsonPath.read(shipment, "$.orderReference")).isEqualTo(number);
        assertThat((String) JsonPath.read(shipment, "$.orderNumber")).isEqualTo(number);
        assertThat((String) JsonPath.read(shipment, "$.deliveryCharged.amount")).isEqualTo("561.00");

        track(id, "PICKED_UP");
        assertThat((String) JsonPath.read(read("/api/admin/orders/{n}", ADMIN, number), "$.status")).isEqualTo("SHIPPED");
        track(id, "DELIVERED");
        String admin = read("/api/admin/orders/{n}", ADMIN, number);
        assertThat((String) JsonPath.read(admin, "$.status")).isEqualTo("DELIVERED");
        assertThat((List<String>) JsonPath.read(admin, "$.shipments[*].id")).containsExactly(id);

        // The customer sees the parcel, without internal notes or staff names
        String mine = read("/api/orders/{n}", customer, number);
        assertThat((List<String>) JsonPath.read(mine, "$.shipments[0].steps[*].status"))
                .containsExactly("BOOKED", "PICKED_UP", "DELIVERED");
        assertThat((String) JsonPath.read(mine, "$.shipments[0].steps[1].location")).isEqualTo("Jaffna");
        assertThat(mine).doesNotContain("internal note").doesNotContain("owner@example.com").doesNotContain("courierCost");
    }

    @Test
    void courierExpensesAndTheGrossMarginReport() throws Exception {
        String number = placeOrder();
        send(post("/api/admin/orders/{n}/status", number), ADMIN, "{\"status\": \"CONFIRMED\"}", 200);
        String first = JsonPath.read(send(post(SHIPMENTS), ADMIN, shipmentJson(number, "LK", "550"), 201), "$.id");
        String second = JsonPath.read(send(post(SHIPMENTS), ADMIN, shipmentJson(number, "LK", "400"), 201), "$.id");
        String other = JsonPath.read(send(post(SHIPMENTS), ADMIN, shipmentJson(null, "LK", "null"), 201), "$.id");

        send(post(SHIPMENTS + "/{id}/expenses", first), ADMIN, "{\"kind\": \"SURCHARGE\", \"amount\": -10}", 400);
        send(post(SHIPMENTS + "/{id}/expenses", first), ADMIN,
                "{\"kind\": \"SURCHARGE\", \"amount\": 100, \"reference\": \"INV-7\"}", 200);
        String detail = send(post(SHIPMENTS + "/{id}/expenses", first), ADMIN,
                "{\"kind\": \"ADJUSTMENT\", \"amount\": -50, \"note\": \"Refund\"}", 200);
        assertThat((String) JsonPath.read(detail, "$.totalCourierCost.amount")).isEqualTo("600.00"); // 550 + 100 − 50
        send(post(SHIPMENTS + "/{id}/expenses", first), ADMIN,
                "{\"kind\": \"SURCHARGE\", \"amount\": 5, \"incurredOn\": \"2999-01-01\"}", 400);

        String today = LocalDate.now(StoreDefaults.ZONE).toString();
        String report = mockMvc.perform(get(SHIPMENTS + "/expenses-report").param("from", today).param("to", today)
                .with(ADMIN)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String row = "$.rows[?(@.shipmentId == '%s')]";
        assertThat((List<String>) JsonPath.read(report, row.formatted(first) + ".deliveryCharged.amount")).containsExactly("561.00");
        assertThat((List<String>) JsonPath.read(report, row.formatted(first) + ".margin.amount")).containsExactly("-39.00");
        // The delivery charge is counted once per order, on its first parcel
        assertThat((List<Object>) JsonPath.read(report, row.formatted(second) + ".deliveryCharged")).containsOnlyNulls();
        // A parcel without a courier charge is reported as missing, not as 0
        assertThat((List<Object>) JsonPath.read(report, row.formatted(other) + ".totalCourierCost")).containsOnlyNulls();
        assertThat((Integer) JsonPath.read(report, "$.shipmentsWithoutCourierCost")).isGreaterThanOrEqualTo(1);

        mockMvc.perform(get(SHIPMENTS + "/expenses-report").param("from", today).param("to", "2000-01-01").with(ADMIN))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(SHIPMENTS + "/expenses-report").param("from", today).param("to", today)
                .with(customer)).andExpect(status().isForbidden());
    }

    @Test
    void theTrackingListShowsOnlyParcelsOnTheirWay() throws Exception {
        String done = JsonPath.read(send(post(SHIPMENTS), ADMIN, shipmentJson(null, "LK", "null"), 201), "$.id");
        track(done, "PICKED_UP");
        track(done, "DELIVERED");
        String active = JsonPath.read(send(post(SHIPMENTS), ADMIN, shipmentJson(null, "LK", "null"), 201), "$.id");

        String list = mockMvc.perform(get(SHIPMENTS).param("active", "true").param("order", "updated")
                .param("size", "100").with(ADMIN)).andReturn().getResponse().getContentAsString();
        List<String> ids = JsonPath.read(list, "$.content[*].id");
        assertThat(ids).contains(active).doesNotContain(done);
    }

    @Test
    void oldUnusedQuotesAreCleanedUpButQuotesUsedByOrdersStay() throws Exception {
        String number = placeOrder();
        String usedQuote = jdbc.queryForObject("""
                SELECT o.quote_id FROM shipping_quote_options o JOIN orders ord ON ord.shipping_quote_option_id = o.id
                WHERE ord.order_number = ?""", String.class, number);
        String category = JsonPath.read(send(post("/api/admin/categories"), ADMIN,
                "{\"name\": \"C\", \"slug\": \"" + unique("c") + "\"}", 201), "$.id");
        String product = send(post("/api/admin/products"), ADMIN, """
                {"categoryId": "%s", "name": "X", "slug": "%s", "status": "ACTIVE",
                 "variants": [{"sku": "%s", "price": 500, "stockQuantity": 10, "shippingWeightKg": 0.5}]}
                """.formatted(category, unique("x"), unique("X")), 201);
        String unused = JsonPath.read(send(post("/api/shipping/quotes"), anonymous(), """
                {"countryCode": "LK", "items": [{"variantId": "%s", "quantity": 1}]}
                """.formatted((String) JsonPath.read(product, "$.variants[0].id")), 200), "$.quoteId");

        jdbc.update("UPDATE shipping_quotes SET expires_at = now() - interval '30 days', created_at = now() - interval '31 days' "
                + "WHERE id IN (?::uuid, ?::uuid)", usedQuote, unused);
        cleanup.deleteOldUnusedQuotes();

        Integer left = jdbc.queryForObject("SELECT COUNT(*) FROM shipping_quotes WHERE id IN (?::uuid, ?::uuid)",
                Integer.class, usedQuote, unused);
        assertThat(left).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM shipping_quotes WHERE id = ?::uuid", Integer.class, usedQuote))
                .isEqualTo(1);
    }
}
