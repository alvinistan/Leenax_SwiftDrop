package lk.swiftdrop.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * CORS (Cross-Origin Resource Sharing).
 *
 * <p>Browsers block JavaScript on one origin (http://localhost:5173, the React
 * app) from reading responses from another origin (http://localhost:8080, this
 * API) unless the API explicitly allows it. This allows ONLY the frontend
 * origins listed in CORS_ALLOWED_ORIGINS.
 *
 * <p>Since Phase 6 the browser also sends the login cookie (allowCredentials),
 * which is why "*" is never allowed: with credentials, every origin must be named.
 * Spring Security applies this configuration (see SecurityConfig: http.cors()).
 *
 * <p>CORS protects users in browsers; it is not authentication. Tools like
 * curl or Postman ignore it.
 */
@Configuration
public class CorsConfig {

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
        // X-XSRF-TOKEN carries the CSRF token (see SecurityConfig).
        // Idempotency-Key: checkout sends it so a repeated submit returns the same order (Phase 8).
        config.setAllowedHeaders(List.of("Content-Type", "Accept", "X-XSRF-TOKEN", "Idempotency-Key"));
        config.setExposedHeaders(List.of("Location"));
        config.setAllowCredentials(true);
        // Browsers may cache the "preflight" answer for an hour.
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
