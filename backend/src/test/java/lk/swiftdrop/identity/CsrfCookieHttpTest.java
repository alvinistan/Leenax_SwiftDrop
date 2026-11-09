package lk.swiftdrop.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import lk.swiftdrop.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

/**
 * Checks the CSRF cookie with a REAL HTTP request to a running server, as a
 * browser would see it.
 *
 * <p>Why a separate class: MockMvc's csrf() helper (used by other tests)
 * replaces the CSRF token store inside the application it runs against. A
 * separate class gets its own, untouched application.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class CsrfCookieHttpTest {

    @LocalServerPort
    private int port;

    @Test
    void theFirstRequestGivesTheAppAReadableCsrfCookie() throws Exception {
        // Even the very first, not-logged-in request must give the app a token,
        // because the login form itself needs one.
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/me")).build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(401);
        // A response can set several cookies, each in its own Set-Cookie header.
        String csrfCookie = response.headers().allValues("Set-Cookie").stream()
                .filter(cookie -> cookie.startsWith("XSRF-TOKEN="))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No XSRF-TOKEN cookie in " + response.headers().map()));
        // Readable by our JavaScript, so it can copy it into the X-XSRF-TOKEN header.
        assertThat(csrfCookie).doesNotContainIgnoringCase("HttpOnly");
        // No session is created for an anonymous visitor (saves server memory).
        assertThat(response.headers().allValues("Set-Cookie")).noneMatch(c -> c.startsWith("JSESSIONID="));
    }
}
