package lk.swiftdrop.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import lk.swiftdrop.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Phase 11: request limits, login lockout, password change, security headers. */
@SpringBootTest(properties = {
        "app.rate-limit.enabled=true",
        "app.rate-limit.quotes.requests=3",
        "app.rate-limit.login.requests=50",
        "app.rate-limit.max-failed-logins=3"})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SecurityHardeningIntegrationTest {

    private static final String PASSWORD = "a-long-enough-password";

    @Autowired
    private MockMvc mockMvc;

    /** Each test uses its own client address, so the limits don't mix. */
    private static RequestPostProcessor from(String ip) {
        return request -> {
            request.setRemoteAddr(ip);
            return request;
        };
    }

    private static String unique() {
        return "u" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    private MvcResult perform(MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request).andReturn();
    }

    private void register(String email, String ip) throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).with(from(ip))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"%s\", \"password\": \"%s\", \"displayName\": \"T\"}".formatted(email, PASSWORD)))
                .andExpect(status().isCreated());
    }

    private int login(String email, String password, String ip) throws Exception {
        return perform(post("/api/auth/login").with(csrf()).with(from(ip))
                .param("email", email).param("password", password)).getResponse().getStatus();
    }

    @Test
    void publicPriceRequestsAreLimitedPerAddress() throws Exception {
        String body = "{\"countryCode\": \"LK\", \"items\": [{\"variantId\": \"%s\", \"quantity\": 1}]}"
                .formatted(UUID.randomUUID());
        for (int i = 0; i < 3; i++) {
            assertThat(perform(post("/api/shipping/quotes").with(csrf()).with(from("10.1.0.1"))
                    .contentType(MediaType.APPLICATION_JSON).content(body)).getResponse().getStatus()).isNotEqualTo(429);
        }
        MvcResult refused = perform(post("/api/shipping/quotes").with(csrf()).with(from("10.1.0.1"))
                .header("Origin", "http://localhost:5173")
                .contentType(MediaType.APPLICATION_JSON).content(body));
        assertThat(refused.getResponse().getStatus()).isEqualTo(429);
        assertThat(refused.getResponse().getHeader("Retry-After")).isNotBlank();
        assertThat(refused.getResponse().getContentType()).isEqualTo("application/problem+json");
        assertThat(refused.getResponse().getContentAsString()).contains("Too many attempts");
        // The browser can read the 429 (CORS headers are still there)
        assertThat(refused.getResponse().getHeader("Access-Control-Allow-Origin")).isEqualTo("http://localhost:5173");

        // Another visitor is not affected
        assertThat(perform(post("/api/shipping/quotes").with(csrf()).with(from("10.1.0.2"))
                .contentType(MediaType.APPLICATION_JSON).content(body)).getResponse().getStatus()).isNotEqualTo(429);
    }

    @Test
    void anAccountIsLockedAfterRepeatedWrongPasswords() throws Exception {
        String email = unique();
        register(email, "10.2.0.1");
        // Wrong passwords from different addresses still count for the account
        for (int i = 0; i < 3; i++) {
            assertThat(login(email, "wrong-password-" + i, "10.2.0." + (10 + i))).isEqualTo(401);
        }
        // Now even the right password is refused for a while
        MvcResult locked = perform(post("/api/auth/login").with(csrf()).with(from("10.2.0.20"))
                .param("email", email.toUpperCase()).param("password", PASSWORD));
        assertThat(locked.getResponse().getStatus()).isEqualTo(429);
        assertThat(locked.getResponse().getContentAsString()).contains("Too many failed logins for this email");

        // An email without an account behaves the same (nothing reveals which accounts exist)
        String nobody = unique();
        for (int i = 0; i < 3; i++) {
            assertThat(login(nobody, "x", "10.2.1." + i)).isEqualTo(401);
        }
        assertThat(login(nobody, "x", "10.2.1.9")).isEqualTo(429);

        // Other accounts are not affected
        String other = unique();
        register(other, "10.2.0.30");
        assertThat(login(other, PASSWORD, "10.2.0.31")).isEqualTo(204);
    }

    @Test
    void aSuccessfulLoginClearsEarlierMistakes() throws Exception {
        String email = unique();
        register(email, "10.3.0.1");
        assertThat(login(email, "wrong-1", "10.3.0.2")).isEqualTo(401);
        assertThat(login(email, "wrong-2", "10.3.0.2")).isEqualTo(401);
        assertThat(login(email, PASSWORD, "10.3.0.2")).isEqualTo(204);
        assertThat(login(email, "wrong-3", "10.3.0.2")).isEqualTo(401);
        assertThat(login(email, PASSWORD, "10.3.0.2")).isEqualTo(204); // not locked: the count restarted
    }

    @Test
    void usersChangeTheirOwnPasswordWithTheCurrentOne() throws Exception {
        String email = unique();
        register(email, "10.4.0.1");
        MockHttpSession session = (MockHttpSession) mockMvc.perform(post("/api/auth/login").with(csrf())
                        .with(from("10.4.0.1")).param("email", email).param("password", PASSWORD))
                .andExpect(status().isNoContent()).andReturn().getRequest().getSession();
        String json = "{\"currentPassword\": \"%s\", \"newPassword\": \"%s\"}";

        mockMvc.perform(post("/api/auth/password").with(csrf()).with(from("10.4.0.1"))
                        .contentType(MediaType.APPLICATION_JSON).content(json.formatted(PASSWORD, "another-long-password")))
                .andExpect(status().isUnauthorized()); // not logged in
        mockMvc.perform(post("/api/auth/password").with(csrf()).with(from("10.4.0.1")).session(session)
                        .contentType(MediaType.APPLICATION_JSON).content(json.formatted("not-my-password", "another-long-password")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/auth/password").with(csrf()).with(from("10.4.0.1")).session(session)
                        .contentType(MediaType.APPLICATION_JSON).content(json.formatted(PASSWORD, "short")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/auth/password").with(csrf()).with(from("10.4.0.1")).session(session)
                        .contentType(MediaType.APPLICATION_JSON).content(json.formatted(PASSWORD, "another-long-password")))
                .andExpect(status().isNoContent());

        assertThat(login(email, PASSWORD, "10.4.0.2")).isEqualTo(401);
        assertThat(login(email, "another-long-password", "10.4.0.2")).isEqualTo(204);
    }

    @Test
    void apiResponsesCarrySecurityHeaders() throws Exception {
        mockMvc.perform(get("/api/categories").with(from("10.5.0.1")))
                .andExpect(header().string("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"));
    }
}
