package lk.swiftdrop.shipping;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Shipping Phase E: manual DEX booking (AWB) and manual tracking. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@WithMockUser(username = "owner@example.com", roles = "ADMIN")
class ShipmentIntegrationTest {

    private static final String BASE = "/api/admin/shipping/shipments";

    @Autowired
    private MockMvc mockMvc;

    private String send(MockHttpServletRequestBuilder request, String json, int expected) throws Exception {
        return mockMvc.perform(request.with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().is(expected))
                .andReturn().getResponse().getContentAsString();
    }

    private String providerId(String code) throws Exception {
        String providers = mockMvc.perform(get("/api/admin/shipping/providers")).andReturn().getResponse()
                .getContentAsString();
        List<String> ids = JsonPath.read(providers, "$[?(@.code == '" + code + "')].id");
        return ids.get(0);
    }

    private static String awb() {
        return ("DX" + UUID.randomUUID().toString().replace("-", "").substring(0, 10)).toUpperCase();
    }

    private String createJson(String providerId, String awb) {
        return """
                {"providerId": "%s", "details": {"orderReference": "WA-1001", "awb": "%s",
                 "destinationCountry": "LK", "destinationCity": "Colombo", "weightKg": 1.4, "courierCost": 550}}
                """.formatted(providerId, awb);
    }

    @Test
    void recordsAManualDexBookingAndTracksItToDelivery() throws Exception {
        String dex = providerId("DEX");
        String awb = awb();
        String created = send(post(BASE), createJson(dex, awb.toLowerCase()), 201);
        String id = JsonPath.read(created, "$.id");

        mockMvc.perform(get(BASE + "/{id}", id))
                .andExpect(jsonPath("$.awb").value(awb)) // stored in capitals
                .andExpect(jsonPath("$.status").value("BOOKED"))
                .andExpect(jsonPath("$.bookingMethod").value("MANUAL"))
                .andExpect(jsonPath("$.courierCost.amount").value("550.00"))
                .andExpect(jsonPath("$.events.length()").value(1))
                .andExpect(jsonPath("$.events[0].recordedBy").value("owner@example.com"))
                .andExpect(jsonPath("$.allowedNextStatuses",
                        containsInAnyOrder("BOOKED", "LABEL_CREATED", "PICKED_UP", "EXCEPTION", "CANCELLED")));

        send(post(BASE + "/{id}/tracking", id), "{\"status\": \"PICKED_UP\", \"location\": \"Jaffna\"}", 200);
        send(post(BASE + "/{id}/tracking", id), "{\"status\": \"IN_TRANSIT\", \"note\": \"Colombo hub\"}", 200);
        // Not allowed: a collected parcel cannot be cancelled
        send(post(BASE + "/{id}/tracking", id), "{\"status\": \"CANCELLED\"}", 400);
        String delivered = send(post(BASE + "/{id}/tracking", id), "{\"status\": \"DELIVERED\"}", 200);
        org.assertj.core.api.Assertions.assertThat((List<?>) JsonPath.read(delivered, "$.allowedNextStatuses")).isEmpty();
        send(post(BASE + "/{id}/tracking", id), "{\"status\": \"IN_TRANSIT\"}", 400);

        mockMvc.perform(get(BASE).param("q", awb.substring(0, 8).toLowerCase()))
                .andExpect(jsonPath("$.content[0].id").value(id))
                .andExpect(jsonPath("$.content[0].status").value("DELIVERED"));
        mockMvc.perform(get("/api/admin/shipping/audit").param("entityType", "SHIPMENT"))
                .andExpect(jsonPath("$.content[*].entityId", hasItem(id)));
    }

    @Test
    void anAwbCanBeRecordedOnlyOncePerCourier() throws Exception {
        String dex = providerId("DEX");
        String awb = awb();
        send(post(BASE), createJson(dex, awb), 201);
        send(post(BASE), createJson(dex, awb.toLowerCase()), 409);
    }

    @Test
    void aMistypedAwbCanBeCorrectedAndIsAudited() throws Exception {
        String id = JsonPath.read(send(post(BASE), createJson(providerId("DEX"), awb()), 201), "$.id");
        String fixed = awb();
        send(put(BASE + "/{id}", id), """
                {"orderReference": "WA-1001", "awb": "%s", "destinationCountry": "LK", "destinationCity": "Kandy"}
                """.formatted(fixed), 200);
        mockMvc.perform(get(BASE + "/{id}", id))
                .andExpect(jsonPath("$.awb").value(fixed))
                .andExpect(jsonPath("$.destinationCity").value("Kandy"))
                .andExpect(jsonPath("$.status").value("BOOKED"));
        mockMvc.perform(get("/api/admin/shipping/audit").param("entityType", "SHIPMENT"))
                .andExpect(jsonPath("$.content[0].action").value("UPDATE"))
                .andExpect(jsonPath("$.content[0].entityId").value(id));
    }

    @Test
    void aTurnedOffCourierCannotBeUsed() throws Exception {
        // DHL Express is off by default
        send(post(BASE), createJson(providerId("DHL_EXPRESS"), awb()), 400);
    }

    @Test
    void checksTheInput() throws Exception {
        String dex = providerId("DEX");
        send(post(BASE), createJson(dex, "AB"), 400); // AWB too short
        send(post(BASE), createJson(dex, "AB 123 45"), 400); // spaces
        send(post(BASE), """
                {"providerId": "%s", "details": {"orderReference": "x", "awb": "%s", "destinationCountry": "ZZ"}}
                """.formatted(dex, awb()), 400);
        send(post(BASE), """
                {"providerId": "%s", "bookedAt": "2999-01-01T00:00:00Z",
                 "details": {"orderReference": "x", "awb": "%s", "destinationCountry": "LK"}}
                """.formatted(dex, awb()), 400);
        // A service of another courier
        String providers = mockMvc.perform(get("/api/admin/shipping/providers")).andReturn().getResponse()
                .getContentAsString();
        String dhlService = ((List<String>) JsonPath.read(providers, "$[?(@.code == 'DHL_EXPRESS')].services[0].id")).get(0);
        send(post(BASE), """
                {"providerId": "%s", "details": {"serviceId": "%s", "orderReference": "x", "awb": "%s",
                 "destinationCountry": "LK"}}
                """.formatted(dex, dhlService, awb()), 400);
    }

    @Test
    void trackingUpdatesMustBeInTimeOrder() throws Exception {
        String id = JsonPath.read(send(post(BASE), createJson(providerId("DEX"), awb()), 201), "$.id");
        send(post(BASE + "/{id}/tracking", id), "{\"status\": \"PICKED_UP\"}", 200);
        send(post(BASE + "/{id}/tracking", id),
                "{\"status\": \"IN_TRANSIT\", \"occurredAt\": \"2020-01-01T00:00:00Z\"}", 400);
    }

    @Test
    void couriersShowWhatCanBeDoneAndATrackingLink() throws Exception {
        String dex = providerId("DEX");
        String body = """
                {"enabled": true, "ratesSource": "RATE_CARD", "weightRoundingIncrementKg": 1,
                 "rulesVerified": false, "services": [], "trackingUrlTemplate": %s}
                """;
        send(put("/api/admin/shipping/providers/{id}", dex), body.formatted("\"http://insecure.example/{awb}\""), 400);
        send(put("/api/admin/shipping/providers/{id}", dex), body.formatted("\"https://track.example/no-placeholder\""), 400);
        try {
            send(put("/api/admin/shipping/providers/{id}", dex), body.formatted("\"https://track.example/t?awb={awb}\""), 200);
            mockMvc.perform(get("/api/admin/shipping/providers"))
                    .andExpect(jsonPath("$[?(@.code == 'DEX')].capabilities[*]",
                            containsInAnyOrder("RATE_CARD", "MANUAL_BOOKING", "MANUAL_TRACKING", "TRACKING_LINK")));
            String awb = awb();
            String created = send(post(BASE), createJson(dex, awb), 201);
            org.assertj.core.api.Assertions.assertThat((String) JsonPath.read(created, "$.trackingUrl"))
                    .isEqualTo("https://track.example/t?awb=" + awb);
        } finally {
            send(put("/api/admin/shipping/providers/{id}", dex), body.formatted("null"), 200);
        }
    }

    @Test
    void shipmentsAreForAdminsOnly() throws Exception {
        mockMvc.perform(get(BASE).with(user("shopper@example.com").roles("CUSTOMER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/{id}", UUID.randomUUID())).andExpect(status().isNotFound());
    }
}
