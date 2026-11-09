package lk.swiftdrop.media;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.UUID;
import lk.swiftdrop.common.error.BadRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Shared upload steps for product and category images: check the file, store
 * it under a new random key, and clean up files at the right moment.
 */
@Component
public class ImageUploads {

    private static final Logger log = LoggerFactory.getLogger(ImageUploads.class);

    /** Same limit as spring.servlet.multipart.max-file-size, checked again here (defence in depth). */
    static final long MAX_BYTES = 5L * 1024 * 1024;

    private final ImageStorage storage;

    public ImageUploads(ImageStorage storage) {
        this.storage = storage;
    }

    /** A file that passed the checks and is now in storage. */
    public record StoredImage(String key, ImageType type, long sizeBytes) {
    }

    /**
     * Checks the file's real type from its content, then stores it under
     * "{folder}/{random-uuid}.{ext}". The uploaded file NAME is never used:
     * it could contain "../" tricks or personal information.
     */
    public StoredImage store(String folder, MultipartFile file) {
        if (file.isEmpty()) {
            throw new BadRequestException("Choose an image file to upload.");
        }
        if (file.getSize() > MAX_BYTES) {
            // 413 Content Too Large (the same answer the web server gives for oversized uploads)
            throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE, "Images can be at most 5 MB.");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read the uploaded file", e);
        }
        ImageType type = ImageType.detect(bytes)
                .orElseThrow(() -> new BadRequestException("Upload a JPEG, PNG or WebP image."));
        String key = folder + "/" + UUID.randomUUID() + "." + type.extension();
        storage.store(key, bytes, type.contentType());
        return new StoredImage(key, type, bytes.length);
    }

    /**
     * Deletes the file only AFTER the database transaction commits. If the
     * transaction rolls back, the database still points to the file, so it
     * must stay. (If the delete itself fails, the file is merely left over.)
     */
    public void deleteAfterCommit(String key) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteQuietly(key);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteQuietly(key);
            }
        });
    }

    /** Used to undo a store() when saving to the database fails. */
    public void deleteQuietly(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete image {} from storage; it is left over.", key, e);
        }
    }

    public String urlFor(String key) {
        return key == null ? null : storage.urlFor(key);
    }
}
