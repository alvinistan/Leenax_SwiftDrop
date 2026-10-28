package lk.swiftdrop.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.context.annotation.Configuration;

/** Title and version shown at the top of Swagger UI (/swagger-ui.html). */
@Configuration
@OpenAPIDefinition(info = @Info(
        title = "Leenax SwiftDrop API",
        version = "v1",
        description = "Catalogue API. /api/admin/** endpoints are NOT secured until Phase 6."))
public class OpenApiConfig {
}
