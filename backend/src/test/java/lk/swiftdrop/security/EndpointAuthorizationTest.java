package lk.swiftdrop.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import lk.swiftdrop.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Shipping Phase I: EVERY endpoint of the app is checked, so a new endpoint
 * cannot slip through without protection:
 * <ul>
 *   <li>/api/admin/** — visitors get 401, customers get 403;</li>
 *   <li>/api/orders/** — visitors get 401, admins get 403 (orders belong to customer accounts);</li>
 *   <li>everything else must be on the short, reviewed list of public endpoints.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class EndpointAuthorizationTest {

    /** Reviewed public (or "any logged-in user") endpoints: METHOD + path pattern. */
    private static final Set<String> PUBLIC = Set.of(
            "GET /api/categories", "GET /api/categories/{slug}",
            "GET /api/products", "GET /api/products/{slug}",
            "POST /api/shipping/quotes", "GET /api/shipping/quotes/{id}", "GET /api/shipping/destinations",
            "POST /api/cart/price",
            "POST /api/auth/register", "GET /api/auth/me");

    private static final RequestPostProcessor CUSTOMER = user("shopper@example.com").roles("CUSTOMER");
    private static final RequestPostProcessor ADMIN = user("owner@example.com").roles("ADMIN");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping mappings;

    private record Endpoint(HttpMethod method, String pattern) {

        String key() {
            return method.name() + " " + pattern;
        }

        /** A concrete URL: every {variable} gets a harmless value. */
        String url() {
            return pattern.replaceAll("\\{[^}]+}", "00000000-0000-0000-0000-000000000000");
        }
    }

    private List<Endpoint> endpoints() {
        List<Endpoint> all = new ArrayList<>();
        mappings.getHandlerMethods().keySet().forEach(info -> {
            Set<String> patterns = info.getPatternValues();
            Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
            for (String pattern : patterns) {
                if (!pattern.startsWith("/api/")) {
                    continue;
                }
                for (RequestMethod m : methods) {
                    all.add(new Endpoint(HttpMethod.valueOf(m.name()), pattern));
                }
            }
        });
        assertThat(all).as("endpoints found").hasSizeGreaterThan(50);
        return all;
    }

    private int status(Endpoint e, RequestPostProcessor who) throws Exception {
        return mockMvc.perform(MockMvcRequestBuilders.request(e.method(), e.url()).with(who).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andReturn().getResponse().getStatus();
    }

    @Test
    void adminEndpointsRefuseVisitorsAndCustomers() throws Exception {
        List<String> problems = new ArrayList<>();
        for (Endpoint e : endpoints()) {
            if (!e.pattern().startsWith("/api/admin/")) {
                continue;
            }
            int visitor = status(e, anonymous());
            int customer = status(e, CUSTOMER);
            if (visitor != 401) {
                problems.add(e.key() + " visitor → " + visitor);
            }
            if (customer != 403) {
                problems.add(e.key() + " customer → " + customer);
            }
        }
        assertThat(problems).isEmpty();
    }

    @Test
    void orderEndpointsAreForCustomerAccountsOnly() throws Exception {
        List<String> problems = new ArrayList<>();
        for (Endpoint e : endpoints()) {
            if (!e.pattern().startsWith("/api/orders")) {
                continue;
            }
            if (status(e, anonymous()) != 401) {
                problems.add(e.key() + " visitor");
            }
            if (status(e, ADMIN) != 403) {
                problems.add(e.key() + " admin");
            }
        }
        assertThat(problems).isEmpty();
    }

    @Test
    void everyOtherEndpointIsOnTheReviewedPublicList() {
        List<String> unreviewed = endpoints().stream()
                .filter(e -> !e.pattern().startsWith("/api/admin/") && !e.pattern().startsWith("/api/orders"))
                .map(Endpoint::key)
                .filter(key -> !PUBLIC.contains(key))
                .toList();
        assertThat(unreviewed)
                .as("New public endpoints must be reviewed and added to PUBLIC (and to SecurityConfig)")
                .isEmpty();
    }

    @Test
    void stateChangingRequestsNeedTheCsrfToken() throws Exception {
        // Even an admin is refused without the CSRF token.
        int status = mockMvc.perform(MockMvcRequestBuilders.post("/api/admin/tax-rates").with(ADMIN)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"x\", \"percent\": 1}"))
                .andReturn().getResponse().getStatus();
        assertThat(status).isEqualTo(403);
    }
}
