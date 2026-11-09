package lk.swiftdrop.config;

import java.net.URI;
import java.time.Duration;
import lk.swiftdrop.media.ImageStorage;
import lk.swiftdrop.media.S3ImageStorage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.ProfileCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * Connects to S3.
 *
 * <ul>
 *   <li><b>Local development and tests</b>: S3_ENDPOINT points to an
 *       S3-compatible server (S3Mock in Docker). It needs no real credentials.</li>
 *   <li><b>Real AWS</b>: S3_ENDPOINT is empty. Credentials are NEVER written in
 *       configuration: they come from an AWS CLI profile on your PC
 *       (AWS_PROFILE_NAME), or from the server's IAM role in production
 *       (the SDK's default credentials chain).</li>
 * </ul>
 */
@Configuration
public class StorageConfig {

    private final String region;
    private final String endpoint;
    private final String profile;

    public StorageConfig(
            @Value("${app.storage.s3.region}") String region,
            @Value("${app.storage.s3.endpoint:}") String endpoint,
            @Value("${app.storage.s3.profile:}") String profile) {
        this.region = region;
        this.endpoint = endpoint;
        this.profile = profile;
    }

    private boolean isLocal() {
        return !endpoint.isBlank();
    }

    private AwsCredentialsProvider credentials() {
        if (isLocal()) {
            // S3Mock accepts any credentials. These are not secrets.
            return StaticCredentialsProvider.create(AwsBasicCredentials.create("local", "local"));
        }
        if (!profile.isBlank()) {
            return ProfileCredentialsProvider.create(profile);
        }
        return DefaultCredentialsProvider.builder().build();
    }

    // destroyMethod: Spring closes the clients (and their connections) on shutdown.
    @Bean(destroyMethod = "close")
    S3Client s3Client() {
        var builder = S3Client.builder().region(Region.of(region)).credentialsProvider(credentials());
        if (isLocal()) {
            builder.endpointOverride(URI.create(endpoint))
                    // http://localhost:9090/bucket/key instead of http://bucket.localhost:9090/key
                    .forcePathStyle(true);
        }
        return builder.build();
    }

    @Bean(destroyMethod = "close")
    S3Presigner s3Presigner() {
        var builder = S3Presigner.builder().region(Region.of(region)).credentialsProvider(credentials());
        if (isLocal()) {
            builder.endpointOverride(URI.create(endpoint))
                    .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
        }
        return builder.build();
    }

    @Bean
    ImageStorage imageStorage(
            S3Client s3,
            S3Presigner presigner,
            @Value("${app.storage.s3.bucket}") String bucket,
            @Value("${app.storage.s3.url-expiry}") Duration urlExpiry) {
        return new S3ImageStorage(s3, presigner, bucket, urlExpiry);
    }
}
