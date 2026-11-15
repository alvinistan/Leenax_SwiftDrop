package lk.swiftdrop.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lk.swiftdrop.TestcontainersConfiguration;
import lk.swiftdrop.order.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Master Phase 9: PayHere card payments, end to end against PostgreSQL (PayHere itself is simulated). */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
        "app.payhere.merchant-id=1211149",
        "app.payhere.merchant-secret=test-secret-value",
        "app.payhere.mode=sandbox",
        "app.payhere.public-api-base-url=https://api.example.test",
        "app.payhere.frontend-base-url=https://shop.example.test"})
class PaymentIntegrationTest {

    private static final String SECRET = "test-secret-value";
    private static final RequestPostProcessor ADMIN = user("owner@example.com").roles("ADMIN");

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private OrderService orderService;

    private String email;
    private RequestPostProcessor customer;

    private static String unique(String p) {
        return p + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String send(MockHttpServletRequestBuilder request, RequestPostProcessor who, String json, int expected)
            throws Exception {
        return mockMvc.perform(request.with(who).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }

    private String read(String path, RequestPostProcessor who, Object... vars) throws Exception {
        return mockMvc.perform(get(path, vars).with(who)).andReturn().getResponse().getContentAsString();
    }

    @BeforeEach
    void setUp() throws Exception {
        email = unique("payer") + "@example.com";
        send(post("/api/auth/register"), anonymous(),
                "{\"email\": \"%s\", \"password\": \"a-long-enough-password\", \"displayName\": \"Payer\"}".formatted(email), 201);
        customer = user(email).roles("CUSTOMER");
        String cards = read("/api/admin/shipping/rate-cards", ADMIN);
        if (((List<?>) JsonPath.read(cards, "$[?(@.providerCode == 'DEX' && @.countryCode == 'LK')]")).isEmpty()) {
            String service = ((List<String>) JsonPath.read(read("/api/admin/shipping/providers", ADMIN),
                    "$[?(@.code == 'DEX')].services[0].id")).get(0);
            send(post("/api/admin/shipping/rate-cards"), ADMIN, """
                    {"serviceId": "%s", "countryCode": "LK", "enabled": true,
                     "bands": [{"maxWeightKg": 1, "price": 400}, {"maxWeightKg": 2, "price": 550},
                               {"maxWeightKg": 5, "price": 900}]}
                    """.formatted(service), 201);
        }
    }

    /** A card order: 2 × 500 + delivery 561 = 1561.00. Returns {orderNumber, productId}. */
    private String[] placeCardOrder() throws Exception {
        String category = JsonPath.read(send(post("/api/admin/categories"), ADMIN,
                "{\"name\": \"C\", \"slug\": \"" + unique("c") + "\"}", 201), "$.id");
        String product = send(post("/api/admin/products"), ADMIN, """
                {"categoryId": "%s", "name": "Toffee", "slug": "%s", "status": "ACTIVE",
                 "variants": [{"sku": "%s", "price": 500, "stockQuantity": 10, "shippingWeightKg": 0.5}]}
                """.formatted(category, unique("t"), unique("T")), 201);
        String items = "[{\"variantId\": \"%s\", \"quantity\": 2}]".formatted((String) JsonPath.read(product, "$.variants[0].id"));
        String quote = send(post("/api/shipping/quotes"), anonymous(), "{\"countryCode\": \"LK\", \"items\": " + items + "}", 200);
        String order = mockMvc.perform(post("/api/orders").with(customer).with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"items": %s, "quoteOptionId": "%s", "paymentMethod": "CARD",
                                 "address": {"recipientName": "Kamala Devi", "phone": "+94 77 123 4567",
                                             "line1": "12 Temple Road", "city": "Jaffna", "countryCode": "LK"}}
                                """.formatted(items, (String) JsonPath.read(quote, "$.options[0].optionId"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return new String[] {JsonPath.read(order, "$.orderNumber"), JsonPath.read(product, "$.id")};
    }

    /** What PayHere would POST, signed with the shared secret (or not). */
    private int notify(String orderNumber, String amount, String statusCode, String paymentId, String custom1,
                       boolean validSignature) throws Exception {
        String sig = validSignature
                ? PayHereSigner.notificationSignature("1211149", orderNumber, amount, "LKR", statusCode, SECRET)
                : "00000000000000000000000000000000";
        var request = post("/api/payments/payhere/notify").contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .param("merchant_id", "1211149").param("order_id", orderNumber).param("payment_id", paymentId)
                .param("payhere_amount", amount).param("payhere_currency", "LKR").param("status_code", statusCode)
                .param("md5sig", sig).param("method", "VISA").param("status_message", "Successfully completed");
        if (custom1 != null) {
            request.param("custom_1", custom1);
        }
        // No CSRF token and no login: PayHere is not a browser user.
        return mockMvc.perform(request.with(anonymous())).andReturn().getResponse().getStatus();
    }

    private String startCheckout(String number) throws Exception {
        return send(post("/api/orders/{n}/payhere-checkout", number), customer, "", 200);
    }

    // ---------------------------------------------------------------

    @Test
    void theCheckoutFormIsSignedOnTheServerAndNeverContainsTheSecret() throws Exception {
        assertThat(read("/api/payments/options", anonymous())).contains("\"card\":true");
        String number = placeCardOrder()[0];
        String form = startCheckout(number);

        assertThat((String) JsonPath.read(form, "$.actionUrl")).isEqualTo("https://sandbox.payhere.lk/pay/checkout");
        Map<String, String> f = JsonPath.read(form, "$.fields");
        assertThat(f).containsEntry("merchant_id", "1211149").containsEntry("order_id", number)
                .containsEntry("amount", "1561.00").containsEntry("currency", "LKR")
                .containsEntry("first_name", "Kamala").containsEntry("last_name", "Devi")
                .containsEntry("email", email).containsEntry("country", "Sri Lanka")
                .containsEntry("notify_url", "https://api.example.test/api/payments/payhere/notify")
                .containsEntry("return_url", "https://shop.example.test/account/orders/" + number + "?payment=return")
                .containsEntry("hash", PayHereSigner.checkoutHash("1211149", number, new java.math.BigDecimal("1561.00"),
                        "LKR", SECRET));
        assertThat(form).doesNotContain(SECRET);

        // Someone else's order: not found
        mockMvc.perform(post("/api/orders/{n}/payhere-checkout", number).with(user("other@example.com").roles("CUSTOMER"))
                .with(csrf())).andExpect(status().isNotFound());
    }

    @Test
    void onlyAVerifiedNotificationMarksTheOrderPaid() throws Exception {
        String number = placeCardOrder()[0];
        String attempt = JsonPath.read(startCheckout(number), "$.fields.custom_1");

        assertThat(notify(number, "1561.00", "2", "320025071278", attempt, false)).isEqualTo(400); // forged
        assertThat((String) JsonPath.read(read("/api/orders/{n}", customer, number), "$.paymentStatus")).isEqualTo("UNPAID");
        assertThat(notify(number, "1.00", "2", "320025071278", attempt, true)).isEqualTo(400); // wrong amount
        assertThat((String) JsonPath.read(read("/api/orders/{n}", customer, number), "$.paymentStatus")).isEqualTo("UNPAID");

        assertThat(notify(number, "1561.00", "2", "320025071278", attempt, true)).isEqualTo(200);
        String mine = read("/api/orders/{n}", customer, number);
        assertThat((String) JsonPath.read(mine, "$.paymentStatus")).isEqualTo("PAID");
        assertThat((Boolean) JsonPath.read(mine, "$.canPayOnline")).isFalse();

        // PayHere may send the same notification again: nothing changes
        assertThat(notify(number, "1561.00", "2", "320025071278", attempt, true)).isEqualTo(200);
        String admin = read("/api/admin/orders/{n}", ADMIN, number);
        assertThat((List<String>) JsonPath.read(admin, "$.history[?(@.status == 'PAID')].status")).hasSize(1);
        assertThat((List<String>) JsonPath.read(admin, "$.payments[*].status")).containsExactly("SUCCEEDED");
        assertThat((List<String>) JsonPath.read(admin, "$.payments[*].providerPaymentId")).containsExactly("320025071278");
        assertThat(admin).contains("does not match the order total"); // the wrong-amount attempt is noted
    }

    @Test
    void aChargeBackMakesTheOrderUnpaidAndBlocksShipping() throws Exception {
        String number = placeCardOrder()[0];
        String attempt = JsonPath.read(startCheckout(number), "$.fields.custom_1");
        notify(number, "1561.00", "2", "320025071279", attempt, true);
        send(post("/api/admin/orders/{n}/status", number), ADMIN, "{\"status\": \"CONFIRMED\"}", 200);
        assertThat((Boolean) JsonPath.read(read("/api/admin/orders/{n}", ADMIN, number), "$.dispatch.ready")).isTrue();

        assertThat(notify(number, "1561.00", "-3", "320025071279", attempt, true)).isEqualTo(200);
        String admin = read("/api/admin/orders/{n}", ADMIN, number);
        assertThat((String) JsonPath.read(admin, "$.paymentStatus")).isEqualTo("UNPAID");
        assertThat((Boolean) JsonPath.read(admin, "$.dispatch.ready")).isFalse();
        assertThat((Boolean) JsonPath.read(admin, "$.dispatch.paymentOverridable")).isFalse();
    }

    @Test
    void unpaidCardOrdersAreCancelledAndTheirStockReturned() throws Exception {
        String[] placed = placeCardOrder();
        String stockBefore = JsonPath.read(read("/api/admin/products/{id}", ADMIN, placed[1]), "$.variants[0].stockQuantity");
        assertThat(stockBefore).isEqualTo("8");

        orderService.cancelUnpaidCardOrders(Instant.now().plusSeconds(60));

        assertThat((String) JsonPath.read(read("/api/orders/{n}", customer, placed[0]), "$.status")).isEqualTo("CANCELLED");
        assertThat((String) JsonPath.read(read("/api/admin/products/{id}", ADMIN, placed[1]), "$.variants[0].stockQuantity"))
                .isEqualTo("10");
        // A payment arriving afterwards is recorded but the order stays cancelled (the owner refunds it)
        assertThat(notify(placed[0], "1561.00", "2", "320025071280", null, true)).isEqualTo(200);
        String admin = read("/api/admin/orders/{n}", ADMIN, placed[0]);
        assertThat((String) JsonPath.read(admin, "$.status")).isEqualTo("CANCELLED");
        assertThat(admin).contains("Refund it in PayHere");
    }
}
