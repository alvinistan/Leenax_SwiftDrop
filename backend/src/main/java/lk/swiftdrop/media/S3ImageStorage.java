package lk.swiftdrop.media;

import java.time.Duration;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

/**
 * Stores images in an S3 bucket that is PRIVATE: nobody can read a file
 * directly. Browsers get a pre-signed URL instead: a normal link with a
 * signature and an expiry time, which only works for that one file, for a
 * short while.
 */
public class S3ImageStorage implements ImageStorage {

    private final S3Client s3;
    private final S3Presigner presigner;
    private final String bucket;
    private final Duration urlExpiry;

    public S3ImageStorage(S3Client s3, S3Presigner presigner, String bucket, Duration urlExpiry) {
        this.s3 = s3;
        this.presigner = presigner;
        this.bucket = bucket;
        this.urlExpiry = urlExpiry;
    }

    @Override
    public void store(String key, byte[] bytes, String contentType) {
        s3.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        // Keys are never reused (each upload gets a new UUID), so
                        // browsers may cache an image for a long time.
                        .cacheControl("public, max-age=31536000, immutable")
                        .build(),
                RequestBody.fromBytes(bytes));
    }

    @Override
    public void delete(String key) {
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }

    /** Signing happens on this server (no network call), so it is fast. */
    @Override
    public String urlFor(String key) {
        return presigner.presignGetObject(GetObjectPresignRequest.builder()
                        .signatureDuration(urlExpiry)
                        .getObjectRequest(GetObjectRequest.builder().bucket(bucket).key(key).build())
                        .build())
                .url()
                .toString();
    }
}
