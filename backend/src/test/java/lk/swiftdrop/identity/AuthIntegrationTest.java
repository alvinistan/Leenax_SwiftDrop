package lk.swiftdrop.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.contains;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.EnumSet;
import lk.swiftdrop.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The real security setup, end to end: the first admin is created from
 * configuration, then we log in and out like the React app does.
 */
@SpringBootTest(properties = {
        "app.admin.email=Owner@Example.com",
        "app.admin.password=correct-horse-battery-staple"})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthIntegrationTest {

    private static final String ADMIN_EMAIL = "owner@example.com";
    private static final String ADMIN_PASSWORD = "correct-horse-battery-staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository users;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private AdminProvisioner adminProvisioner;

    /** Logs in like the React app (form fields + CSRF token) and returns the session. */
    private MockHttpSession logIn(String email, String password) throws Exception {
        return (MockHttpSession) mockMvc.perform(post("/api/auth/login").with(csrf())
                        .param("email", email)
                        .param("password", password))
                .andExpect(status().isNoContent())
                .andReturn().getRequest().getSession();
    }

    @Test
    void theFirstAdminIsCreatedOnceWithAHashedPassword() {
        User admin = users.findByEmail(ADMIN_EMAIL).orElseThrow();

        assertThat(admin.getRoles()).containsExactly(Role.ADMIN);
        assertThat(admin.getPasswordHash()).startsWith("{bcrypt}").doesNotContain(ADMIN_PASSWORD);

        adminProvisioner.run(null); // e.g. the next restart
        assertThat(users.findAll().stream().filter(u -> u.getRoles().contains(Role.ADMIN))).hasSize(1);
    }

    @Test
    void anAdminCanLogInSeeTheirAccountAndLogOut() throws Exception {
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());

        // the email is not case-sensitive
        MockHttpSession session = logIn("OWNER@example.com", ADMIN_PASSWORD);

        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(ADMIN_EMAIL))
                .andExpect(jsonPath("$.roles", contains("ADMIN")));
        mockMvc.perform(get("/api/admin/categories").session(session)).andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/logout").with(csrf()).session(session))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void aWrongPasswordOrUnknownEmailGetsTheSameAnswer() throws Exception {
        for (String email : new String[] {ADMIN_EMAIL, "nobody@example.com"}) {
            mockMvc.perform(post("/api/auth/login").with(csrf())
                            .param("email", email)
                            .param("password", "wrong-password-123"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.detail").value("The email or password is incorrect."));
        }
    }

    @Test
    void adminEndpointsRequireLoginAndACsrfToken() throws Exception {
        String body = """
                {"name": "Toys", "slug": "toys-auth-test"}
                """;
        // not logged in
        mockMvc.perform(post("/api/admin/categories").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());

        // logged in, but no CSRF token (what a forged request from another site looks like)
        MockHttpSession session = logIn(ADMIN_EMAIL, ADMIN_PASSWORD);
        mockMvc.perform(post("/api/admin/categories").session(session)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());

        // logged in with the token
        mockMvc.perform(post("/api/admin/categories").session(session).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
    }

    @Test
    void customersAreLoggedInButNotAllowedIntoAdmin() throws Exception {
        users.save(new User("shopper@example.com", passwordEncoder.encode("shopper-password-1"),
                "Shopper", EnumSet.of(Role.CUSTOMER)));
        MockHttpSession session = logIn("shopper@example.com", "shopper-password-1");

        mockMvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/categories").session(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("You do not have permission to do this."));
    }

    @Test
    void theStorefrontStaysPublicAndUnknownPathsAreDenied() throws Exception {
        mockMvc.perform(get("/api/categories")).andExpect(status().isOk());
        mockMvc.perform(get("/api/products")).andExpect(status().isOk());
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mockMvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
    }

    @Test
    void aWeakInitialAdminPasswordStopsStartup() {
        UserRepository emptyRepository = org.mockito.Mockito.mock(UserRepository.class);
        AdminProvisioner provisioner =
                new AdminProvisioner(emptyRepository, passwordEncoder, "a@example.com", "short");

        assertThatThrownBy(() -> provisioner.run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 12 characters");
    }
}
