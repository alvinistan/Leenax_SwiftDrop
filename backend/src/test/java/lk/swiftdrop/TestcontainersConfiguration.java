package lk.swiftdrop;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Throw-away services in Docker for tests:
 * <ul>
 *   <li>PostgreSQL ({@code @ServiceConnection} points the datasource at it)</li>
 *   <li>S3Mock, an S3-compatible server, so image tests need no AWS account or keys</li>
 * </ul>
 * Use the same versions as docker-compose.yml.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    static final String TEST_BUCKET = "swiftdrop-test-images";

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));
    }

    @Bean
    GenericContainer<?> s3MockContainer() {
        return new GenericContainer<>(DockerImageName.parse("adobe/s3mock:5.2.3"))
                .withExposedPorts(9090)
                .withEnv("COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS", TEST_BUCKET)
                .waitingFor(Wait.forHttp("/").forPort(9090));
    }

    /** Points the app's S3 settings at the S3Mock container (its port is random). */
    @Bean
    DynamicPropertyRegistrar s3Properties(GenericContainer<?> s3MockContainer) {
        return registry -> {
            registry.add("app.storage.s3.endpoint",
                    () -> "http://" + s3MockContainer.getHost() + ":" + s3MockContainer.getMappedPort(9090));
            registry.add("app.storage.s3.bucket", () -> TEST_BUCKET);
        };
    }
}
