package lk.swiftdrop.performance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManagerFactory;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lk.swiftdrop.TestcontainersConfiguration;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
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
 * Phase 11 performance guard: the number of SQL statements a page needs must
 * NOT grow with the number of rows on it (the "N+1 queries" problem: one
 * query for the list plus one more per row). Each page is measured, more data
 * is added, and it is measured again.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@SuppressWarnings("unchecked")
class QueryCountIntegrationTest {

    private static final RequestPostProcessor ADMIN = user("owner@example.com").roles("ADMIN");

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private EntityManagerFactory emf;

    private RequestPostProcessor customer;
    private String customerEmail;

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String send(MockHttpServletRequestBuilder request, RequestPostProcessor who, String json, int expected)
            throws Exception {
        return mockMvc.perform(request.with(who).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }

    private String read(String path, RequestPostProcessor who) throws Exception {
        return mockMvc.perform(get(path).with(who)).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString();
    }

    private String category;

    private void setUp() throws Exception {
        customerEmail = unique("q") + "@example.com";
        send(post("/api/auth/register"), anonymous(),
                "{\"email\": \"%s\", \"password\": \"a-long-enough-password\", \"displayName\": \"Q\"}"
                        .formatted(customerEmail), 201);
        customer = user(customerEmail).roles("CUSTOMER");
        String cards = read("/api/admin/shipping/rate-cards", ADMIN);
        if (((List<?>) JsonPath.read(cards, "$[?(@.providerCode == 'DEX' && @.countryCode == 'LK')]")).isEmpty()) {
            String dexService = ((List<String>) JsonPath.read(read("/api/admin/shipping/providers", ADMIN),
                    "$[?(@.code == 'DEX')].services[0].id")).get(0);
            send(post("/api/admin/shipping/rate-cards"), ADMIN, """
                    {"serviceId": "%s", "countryCode": "LK", "enabled": true,
                     "bands": [{"maxWeightKg": 1, "price": 400}, {"maxWeightKg": 2, "price": 550},
                               {"maxWeightKg": 5, "price": 900}, {"maxWeightKg": 10, "price": 1500}]}
                    """.formatted(dexService), 201);
        }
        category = JsonPath.read(send(post("/api/admin/categories"), ADMIN,
                "{\"name\": \"Q\", \"slug\": \"" + unique("q") + "\"}", 201), "$.id");
    }

    /** A product with two variants and a confirmed order for it: shipped, or waiting in the dispatch queue. */
    private void addProductAndOrder(boolean ship) throws Exception {
        String product = send(post("/api/admin/products"), ADMIN, """
                {"categoryId": "%s", "name": "Toffee", "slug": "%s", "status": "ACTIVE", "codAllowed": true,
                 "variants": [{"sku": "%s", "price": 500, "stockQuantity": 50, "shippingWeightKg": 0.5},
                              {"sku": "%s", "price": 700, "stockQuantity": 50, "shippingWeightKg": 0.5}]}
                """.formatted(category, unique("t"), unique("A"), unique("B")), 201);
        String items = "[{\"variantId\": \"%s\", \"quantity\": 1}, {\"variantId\": \"%s\", \"quantity\": 1}]"
                .formatted((String) JsonPath.read(product, "$.variants[0].id"),
                        (String) JsonPath.read(product, "$.variants[1].id"));
        String quote = send(post("/api/shipping/quotes"), anonymous(), "{\"countryCode\": \"LK\", \"items\": " + items + "}", 200);
        String option = ((List<String>) JsonPath.read(quote, "$.options[?(@.providerName =~ /.*DEX.*/)].optionId")).get(0);
        String order = mockMvc.perform(post("/api/orders").with(customer).with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"items": %s, "quoteOptionId": "%s", "paymentMethod": "COD",
                                 "address": {"recipientName": "Kamala", "phone": "+94 77 123 4567",
                                             "line1": "12 Temple Road", "city": "Jaffna", "countryCode": "LK"}}
                                """.formatted(items, option)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String number = JsonPath.read(order, "$.orderNumber");
        send(post("/api/admin/orders/{n}/status", number), ADMIN, "{\"status\": \"CONFIRMED\"}", 200);
        if (!ship) {
            return;
        }
        String dex = ((List<String>) JsonPath.read(read("/api/admin/shipping/providers", ADMIN),
                "$[?(@.code == 'DEX')].id")).get(0);
        String shipment = JsonPath.read(send(post("/api/admin/shipping/shipments"), ADMIN, """
                {"providerId": "%s", "orderNumber": "%s",
                 "details": {"orderReference": "x", "awb": "%s", "destinationCountry": "LK", "courierCost": 400}}
                """.formatted(dex, number, unique("DX").toUpperCase()), 201), "$.id");
        send(post("/api/admin/shipping/shipments/{id}/tracking", shipment), ADMIN, "{\"status\": \"PICKED_UP\"}", 200);
    }

    private long statements(String path, RequestPostProcessor who) throws Exception {
        Statistics stats = emf.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        read(path, who);
        return stats.getPrepareStatementCount();
    }

    private Map<String, Long> measure() throws Exception {
        String today = java.time.LocalDate.now(lk.swiftdrop.store.StoreDefaults.ZONE).toString();
        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("shop: product list", statements("/api/products?size=50", anonymous()));
        counts.put("customer: my orders", statements("/api/orders", customer));
        counts.put("admin: orders", statements("/api/admin/orders?size=50", ADMIN));
        counts.put("admin: dispatch", statements("/api/admin/orders/dispatch-queue", ADMIN));
        counts.put("admin: shipments", statements("/api/admin/shipping/shipments?size=50", ADMIN));
        counts.put("admin: tracking", statements("/api/admin/shipping/shipments?active=true&order=updated&size=50", ADMIN));
        counts.put("admin: expenses report",
                statements("/api/admin/shipping/shipments/expenses-report?from=" + today + "&to=" + today, ADMIN));
        counts.put("admin: summary report",
                statements("/api/admin/shipping/shipments/summary-report?from=" + today + "&to=" + today, ADMIN));
        counts.put("admin: products", statements("/api/admin/products?size=50", ADMIN));
        return counts;
    }

    @Test
    void pagesNeedTheSameNumberOfQueriesWithMoreRows() throws Exception {
        setUp();
        addProductAndOrder(true);
        addProductAndOrder(false);
        Map<String, Long> few = measure();
        for (int i = 0; i < 6; i++) {
            addProductAndOrder(i % 2 == 0);
        }
        Map<String, Long> many = measure();
        StringBuilder report = new StringBuilder();
        few.forEach((page, n) -> report.append("%-28s %3d -> %3d%n".formatted(page, n, many.get(page))));
        System.out.println("SQL statements per page (2 orders -> 8 orders):\n" + report);
        few.forEach((page, n) -> assertThat(many.get(page)).as(page + "\n" + report).isLessThanOrEqualTo(n));
    }
}
