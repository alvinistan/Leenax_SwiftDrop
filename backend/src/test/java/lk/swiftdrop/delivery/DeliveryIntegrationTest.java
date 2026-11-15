package lk.swiftdrop.delivery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Map;
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
import tools.jackson.databind.ObjectMapper;

/**
 * Master Phase 10: own delivery staff (assignment, staff pages, failed
 * attempts, proof of delivery) and cash on delivery until it reaches the owner.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@SuppressWarnings("unchecked")
class DeliveryIntegrationTest {

    private static final RequestPostProcessor ADMIN = user("owner@example.com").roles("ADMIN");
    private static final String SHIPMENTS = "/api/admin/shipping/shipments";
    private static final String JOBS = "/api/delivery/jobs";
    private static final String LOCAL = "40000";
    private static final String OWN = "SwiftDrop own delivery";
    private static final String DEX = "Daraz Express Logistics (DEX)";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper json;

    private RequestPostProcessor customer;

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String send(MockHttpServletRequestBuilder request, RequestPostProcessor who, String body, int expected)
            throws Exception {
        return mockMvc.perform(request.with(who).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().is(expected))
                .andReturn().getResponse().getContentAsString();
    }

    private String read(String path, RequestPostProcessor who, Object... vars) throws Exception {
        return mockMvc.perform(get(path, vars).with(who)).andReturn().getResponse().getContentAsString();
    }

    private int statusOf(String path, RequestPostProcessor who, Object... vars) throws Exception {
        return mockMvc.perform(get(path, vars).with(who)).andReturn().getResponse().getStatus();
    }

    private Map<String, Object> provider(String code) throws Exception {
        List<Map<String, Object>> found = JsonPath.read(read("/api/admin/shipping/providers", ADMIN),
                "$[?(@.code == '" + code + "')]");
        return found.get(0);
    }

    private String serviceId(String code) throws Exception {
        return (String) ((List<Map<String, Object>>) provider(code).get("services")).get(0).get("id");
    }

    /** Own delivery on, covering postal code 40000 only, with a Sri Lanka rate card. */
    @BeforeEach
    void setUp() throws Exception {
        String email = unique("buyer") + "@example.com";
        send(post("/api/auth/register"), anonymous(),
                "{\"email\": \"%s\", \"password\": \"a-long-enough-password\", \"displayName\": \"Buyer\"}".formatted(email),
                201);
        customer = user(email).roles("CUSTOMER");

        Map<String, Object> own = provider("OWN_DELIVERY");
        String body = json.writeValueAsString(Map.of(
                "enabled", true, "ratesSource", "RATE_CARD", "weightRoundingIncrementKg", 1, "rulesVerified", true,
                "services", List.of(Map.of("id", serviceId("OWN_DELIVERY"), "enabled", true,
                        "postalCodes", List.of(" 40 000 ")))));
        String updated = send(put("/api/admin/shipping/providers/{id}", own.get("id")), ADMIN, body, 200);
        assertThat((List<String>) JsonPath.read(updated, "$.services[0].postalCodes")).containsExactly(LOCAL);
        assertThat((List<String>) JsonPath.read(updated, "$.capabilities")).contains("STAFF_DELIVERY")
                .doesNotContain("TRACKING_LINK");

        // The same DEX card as the other tests (they share the database and expect these prices).
        for (String code : List.of("OWN_DELIVERY", "DEX")) {
            String cards = read("/api/admin/shipping/rate-cards", ADMIN);
            if (((List<?>) JsonPath.read(cards, "$[?(@.providerCode == '" + code + "' && @.countryCode == 'LK')]")).isEmpty()) {
                send(post("/api/admin/shipping/rate-cards"), ADMIN, """
                        {"serviceId": "%s", "countryCode": "LK", "enabled": true,
                         "bands": [{"maxWeightKg": 1, "price": 400}, {"maxWeightKg": 2, "price": 550},
                                   {"maxWeightKg": 5, "price": 900}, {"maxWeightKg": 10, "price": 1500}]}
                        """.formatted(serviceId(code)), 201);
            }
        }
    }

    private String items() throws Exception {
        String category = JsonPath.read(send(post("/api/admin/categories"), ADMIN,
                "{\"name\": \"C\", \"slug\": \"" + unique("c") + "\"}", 201), "$.id");
        String product = send(post("/api/admin/products"), ADMIN, """
                {"categoryId": "%s", "name": "Palmyra jaggery", "slug": "%s", "status": "ACTIVE", "codAllowed": true,
                 "variants": [{"sku": "%s", "price": 500, "stockQuantity": 10, "shippingWeightKg": 0.5}]}
                """.formatted(category, unique("j"), unique("J")), 201);
        return "[{\"variantId\": \"%s\", \"quantity\": 2}]".formatted((String) JsonPath.read(product, "$.variants[0].id"));
    }

    private List<String> offeredCouriers(String items, String postal) throws Exception {
        String quote = send(post("/api/shipping/quotes"), anonymous(), "{\"countryCode\": \"LK\", \"items\": %s%s}"
                .formatted(items, postal == null ? "" : ", \"postalCode\": \"" + postal + "\""), 200);
        return JsonPath.read(quote, "$.options[*].providerName");
    }

    /** A confirmed COD order delivered by the given courier (name), postal code 40000. */
    private String confirmedCodOrder(String courier) throws Exception {
        String items = items();
        String quote = send(post("/api/shipping/quotes"), anonymous(),
                "{\"countryCode\": \"LK\", \"postalCode\": \"40000\", \"items\": " + items + "}", 200);
        String option = ((List<String>) JsonPath.read(quote, "$.options[?(@.providerName == '" + courier + "')].optionId"))
                .get(0);
        String order = mockMvc.perform(post("/api/orders").with(customer).with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"items": %s, "quoteOptionId": "%s", "paymentMethod": "COD",
                                 "address": {"recipientName": "Kamala", "phone": "+94 77 123 4567",
                                             "line1": "12 Temple Road", "city": "Jaffna", "postalCode": "40000",
                                             "countryCode": "LK"}}
                                """.formatted(items, option)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String number = JsonPath.read(order, "$.orderNumber");
        send(post("/api/admin/orders/{n}/status", number), ADMIN, "{\"status\": \"CONFIRMED\"}", 200);
        return number;
    }

    private String createStaff(String name) throws Exception {
        String email = unique("rider") + "@example.com";
        String staff = send(post("/api/admin/delivery/staff"), ADMIN, """
                {"displayName": "%s", "email": "%s", "password": "a-long-staff-password"}
                """.formatted(name, email), 201);
        return JsonPath.read(staff, "$.id") + "|" + email;
    }

    private String ownShipment(String orderNumber, String staffId) throws Exception {
        return send(post(SHIPMENTS), ADMIN, """
                {"providerId": "%s", "orderNumber": "%s", "assignedToUserId": %s,
                 "details": {"orderReference": "x", "awb": "", "destinationCountry": "LK", "destinationCity": "Jaffna"}}
                """.formatted(provider("OWN_DELIVERY").get("id"), orderNumber,
                staffId == null ? "null" : "\"" + staffId + "\""), 201);
    }

    private String job(String shipmentId, RequestPostProcessor staff, String body, int expected) throws Exception {
        return send(post(JOBS + "/{id}/updates", shipmentId), staff, body, expected);
    }

    // ---------------------------------------------------------------

    @Test
    void ownDeliveryIsOfferedOnlyInsideItsPostalCodes() throws Exception {
        String items = items();
        assertThat(offeredCouriers(items, "40000")).contains(OWN, DEX);
        assertThat(offeredCouriers(items, "10100")).contains(DEX).doesNotContain(OWN);
        assertThat(offeredCouriers(items, null)).doesNotContain(OWN);
    }

    @Test
    void staffDeliverACashOrderAndTheOwnerReceivesTheCash() throws Exception {
        String[] rider = createStaff("Ravi").split("\\|");
        RequestPostProcessor ravi = user(rider[1]).roles("DELIVERY");
        RequestPostProcessor someoneElse = user(createStaff("Other").split("\\|")[1]).roles("DELIVERY");
        String number = confirmedCodOrder(OWN);
        String total = JsonPath.read(read("/api/admin/orders/{n}", ADMIN, number), "$.grandTotal.amount");

        String shipment = ownShipment(number, rider[0]);
        String id = JsonPath.read(shipment, "$.id");
        assertThat((String) JsonPath.read(shipment, "$.awb")).matches("LD-\\d{6}"); // our own reference
        assertThat((Boolean) JsonPath.read(shipment, "$.staffDelivery")).isTrue();
        assertThat((String) JsonPath.read(shipment, "$.assignedTo.name")).isEqualTo("Ravi");
        assertThat((String) JsonPath.read(shipment, "$.events[0].note")).isEqualTo("Ready for our own delivery");
        assertThat((String) JsonPath.read(shipment, "$.cashToCollect.amount")).isEqualTo(total);

        // Ravi sees the job with the address; another staff member does not
        String jobs = read(JOBS, ravi);
        assertThat((List<String>) JsonPath.read(jobs, "$[*].id")).containsExactly(id);
        assertThat((String) JsonPath.read(read(JOBS + "/{id}", ravi, id), "$.phone")).isEqualTo("+94 77 123 4567");
        assertThat(statusOf(JOBS + "/{id}", someoneElse, id)).isEqualTo(404);
        job(id, someoneElse, "{\"action\": \"START\"}", 404);

        job(id, ravi, "{\"action\": \"DELIVERED\", \"receivedBy\": \"Kamala\", \"cashCollected\": true}", 400); // not started
        job(id, ravi, "{\"action\": \"START\"}", 200);
        assertThat((String) JsonPath.read(read("/api/admin/orders/{n}", ADMIN, number), "$.status")).isEqualTo("SHIPPED");

        // A failed attempt, then a second try
        job(id, ravi, "{\"action\": \"FAILED\"}", 400);
        job(id, ravi, "{\"action\": \"FAILED\", \"failureReason\": \"OTHER\"}", 400); // "other" needs a note
        String failed = job(id, ravi, "{\"action\": \"FAILED\", \"failureReason\": \"NOT_AT_HOME\", \"note\": \"Gate locked\"}", 200);
        assertThat((String) JsonPath.read(failed, "$.failedAttempts[0].reason")).isEqualTo("Nobody was at home");
        job(id, ravi, "{\"action\": \"START\"}", 200);

        // Delivered: receiver's name and the cash are required
        job(id, ravi, "{\"action\": \"DELIVERED\", \"receivedBy\": \"Kamala\"}", 400);
        job(id, ravi, "{\"action\": \"DELIVERED\", \"cashCollected\": true}", 400);
        job(id, ravi, "{\"action\": \"DELIVERED\", \"receivedBy\": \"Kamala\", \"cashCollected\": true}", 200);

        String order = read("/api/admin/orders/{n}", ADMIN, number);
        assertThat((String) JsonPath.read(order, "$.status")).isEqualTo("DELIVERED");
        assertThat((String) JsonPath.read(order, "$.paymentStatus")).isEqualTo("UNPAID"); // the cash is with Ravi
        // Finished: the address is gone from Ravi's view
        assertThat(statusOf(JOBS + "/{id}", ravi, id)).isEqualTo(404);
        assertThat((List<?>) JsonPath.read(read(JOBS, ravi), "$")).isEmpty();

        // The customer sees the failed attempt and who received it, never the staff email or the note
        String mine = read("/api/orders/{n}", customer, number);
        assertThat((List<String>) JsonPath.read(mine, "$.shipments[0].steps[*].failedBecause")).contains("Nobody was at home");
        assertThat((List<String>) JsonPath.read(mine, "$.shipments[0].steps[*].receivedBy")).contains("Kamala");
        assertThat(mine).doesNotContain(rider[1]).doesNotContain("Gate locked");

        // Cash on delivery: Ravi holds it until he hands it to the owner
        String cod = read("/api/admin/delivery/cod", ADMIN);
        String row = "$.held[?(@.orderNumber == '" + number + "')]";
        assertThat((List<String>) JsonPath.read(cod, row + ".holderName")).containsExactly("Ravi");
        assertThat((List<String>) JsonPath.read(cod, row + ".amount.amount")).containsExactly(total);
        String collectionId = ((List<String>) JsonPath.read(cod, row + ".id")).get(0);

        send(post("/api/admin/delivery/cod/settle"), ADMIN,
                "{\"ids\": [\"" + collectionId + "\"], \"reference\": \"Cash 15 Nov\"}", 200);
        assertThat((String) JsonPath.read(read("/api/admin/orders/{n}", ADMIN, number), "$.paymentStatus")).isEqualTo("PAID");
        send(post("/api/admin/delivery/cod/settle"), ADMIN, "{\"ids\": [\"" + collectionId + "\"]}", 400); // once only

        // No deliveries left: Ravi can be disabled, and his open session is refused from then on
        send(put("/api/admin/delivery/staff/{id}/status", rider[0]), ADMIN, "{\"enabled\": false}", 200);
        assertThat(statusOf(JOBS, ravi)).isEqualTo(403);
    }

    @Test
    void cashCollectedByACourierIsSettledWhenTheOrderIsMarkedPaid() throws Exception {
        String number = confirmedCodOrder(DEX);
        String shipment = send(post(SHIPMENTS), ADMIN, """
                {"providerId": "%s", "orderNumber": "%s",
                 "details": {"orderReference": "x", "awb": "", "destinationCountry": "LK"}}
                """.formatted(provider("DEX").get("id"), number), 400); // a courier needs its AWB
        assertThat(shipment).contains("AWB");
        String id = JsonPath.read(send(post(SHIPMENTS), ADMIN, """
                {"providerId": "%s", "orderNumber": "%s",
                 "details": {"orderReference": "x", "awb": "%s", "destinationCountry": "LK"}}
                """.formatted(provider("DEX").get("id"), number, unique("DX").toUpperCase()), 201), "$.id");
        // DEX parcels are not given to staff
        send(put(SHIPMENTS + "/{id}/assignee", id), ADMIN, "{\"userId\": \"" + createStaff("R").split("\\|")[0] + "\"}", 400);

        send(post(SHIPMENTS + "/{id}/tracking", id), ADMIN, "{\"status\": \"OUT_FOR_DELIVERY\"}", 200);
        send(post(SHIPMENTS + "/{id}/tracking", id), ADMIN,
                "{\"status\": \"DELIVERED\", \"failureReason\": \"NOT_AT_HOME\"}", 400); // a reason only on failures
        send(post(SHIPMENTS + "/{id}/tracking", id), ADMIN, "{\"status\": \"DELIVERED\"}", 200);

        String cod = read("/api/admin/delivery/cod", ADMIN);
        assertThat((List<String>) JsonPath.read(cod, "$.held[?(@.orderNumber == '" + number + "')].holderName"))
                .containsExactly(DEX);

        send(post("/api/admin/orders/{n}/payment", number), ADMIN, "{}", 200);
        cod = read("/api/admin/delivery/cod", ADMIN);
        assertThat((List<?>) JsonPath.read(cod, "$.held[?(@.orderNumber == '" + number + "')]")).isEmpty();
        assertThat((List<String>) JsonPath.read(cod, "$.recentlyReceived[?(@.orderNumber == '" + number + "')].status"))
                .containsExactly("SETTLED");
    }

    @Test
    void staffAccountsAndAssignmentRules() throws Exception {
        String[] rider = createStaff("Nila").split("\\|");
        // The same email cannot become a second account (a customer is never turned into staff)
        send(post("/api/admin/delivery/staff"), ADMIN, """
                {"displayName": "Copy", "email": "%s", "password": "a-long-staff-password"}
                """.formatted(rider[1].toUpperCase()), 409);
        send(post("/api/admin/delivery/staff"), ADMIN,
                "{\"displayName\": \"Short\", \"email\": \"" + unique("s") + "@example.com\", \"password\": \"short\"}", 400);

        String number = confirmedCodOrder(OWN);
        String id = JsonPath.read(ownShipment(number, null), "$.id");
        // Only active delivery staff can be assigned (not a customer account)
        String customerId = UUID.randomUUID().toString();
        send(put(SHIPMENTS + "/{id}/assignee", id), ADMIN, "{\"userId\": \"" + customerId + "\"}", 400);
        String assigned = send(put(SHIPMENTS + "/{id}/assignee", id), ADMIN, "{\"userId\": \"" + rider[0] + "\"}", 200);
        assertThat((String) JsonPath.read(assigned, "$.assignedTo.name")).isEqualTo("Nila");

        // Someone with deliveries cannot be disabled
        String refused = send(put("/api/admin/delivery/staff/{id}/status", rider[0]), ADMIN, "{\"enabled\": false}", 400);
        assertThat(refused).contains("still has deliveries");
        String list = read("/api/admin/delivery/staff", ADMIN);
        assertThat((List<Integer>) JsonPath.read(list, "$[?(@.id == '" + rider[0] + "')].activeDeliveries")).containsExactly(1);

        // An own delivery marked delivered by the owner needs the receiver's name
        send(post(SHIPMENTS + "/{id}/tracking", id), ADMIN, "{\"status\": \"OUT_FOR_DELIVERY\"}", 200);
        send(post(SHIPMENTS + "/{id}/tracking", id), ADMIN, "{\"status\": \"DELIVERED\"}", 400);
        send(post(SHIPMENTS + "/{id}/tracking", id), ADMIN, "{\"status\": \"DELIVERED\", \"receivedBy\": \"Kamala\"}", 200);
        // ...and the cash is then with the assigned staff member
        assertThat((List<String>) JsonPath.read(read("/api/admin/delivery/cod", ADMIN),
                "$.held[?(@.orderNumber == '" + number + "')].holderName")).containsExactly("Nila");

        // The history records staff changes, never the password
        String history = read("/api/admin/shipping/audit", ADMIN);
        assertThat(history).doesNotContain("a-long-staff-password");
    }
}
