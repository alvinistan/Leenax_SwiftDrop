package lk.swiftdrop.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS (Cross-Origin Resource Sharing).
 *
 * <p>Browsers block JavaScript on one origin (http://localhost:5173, the React
 * app) from reading responses from another origin (http://localhost:8080, this
 * API) unless the API explicitly allows it. This class allows ONLY the
 * frontend origins listed in CORS_ALLOWED_ORIGINS. Never use "*" for an API
 * that will later use logins.
 *
 * <p>CORS protects users in browsers; it is not authentication. Tools like
 * curl or Postman ignore it. Phase 6 secures the admin API properly.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final List<String> allowedOrigins;

    public CorsConfig(@Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE")
                .allowedHeaders("Content-Type", "Accept")
                .exposedHeaders("Location")
                // Browsers may cache the "preflight" answer for an hour.
                .maxAge(3600);
    }
}
