package lk.swiftdrop.catalog.product;

import java.util.UUID;
import lk.swiftdrop.catalog.product.AdminProductResponses.AdminImage;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.media.ImageUploads;
import lk.swiftdrop.media.ImageUploads.StoredImage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Adding and removing product photos. */
@Service
public class ProductImageService {

    /** Keeps storage costs and page weight under control. */
    static final int MAX_IMAGES_PER_PRODUCT = 10;

    private final ProductRepository products;
    private final ImageUploads imageUploads;

    public ProductImageService(ProductRepository products, ImageUploads imageUploads) {
        this.products = products;
        this.imageUploads = imageUploads;
    }

    /**
     * Stores the file in S3 first, then records it in the database. If the
     * database part fails, the stored file is deleted again, so nothing is left over.
     */
    @Transactional
    public AdminImage upload(UUID productId, MultipartFile file, String altText) {
        Product product = find(productId);
        if (product.getImages().size() >= MAX_IMAGES_PER_PRODUCT) {
            throw new ConflictException("A product can have at most " + MAX_IMAGES_PER_PRODUCT + " images.");
        }
        StoredImage stored = imageUploads.store("products/" + productId, file);
        try {
            ProductImage image = product.addImage(
                    stored.key(), stored.type().contentType(), stored.sizeBytes(), cleanAltText(altText));
            products.flush(); // surface database errors here, while we can still undo the upload
            return AdminImage.from(image, imageUploads::urlFor);
        } catch (RuntimeException e) {
            imageUploads.deleteQuietly(stored.key());
            throw e;
        }
    }

    /**
     * Removes the photo. The image must belong to THIS product (404 otherwise),
     * so an id from another product cannot be used to delete its photos (IDOR).
     */
    @Transactional
    public void delete(UUID productId, UUID imageId) {
        Product product = find(productId);
        ProductImage image = product.getImages().stream()
                .filter(i -> i.getId().equals(imageId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Image", imageId));
        product.removeImage(image);
        imageUploads.deleteAfterCommit(image.getObjectKey());
    }

    private static String cleanAltText(String altText) {
        if (altText == null || altText.isBlank()) {
            return null;
        }
        String trimmed = altText.trim();
        return trimmed.length() > 200 ? trimmed.substring(0, 200) : trimmed;
    }

    private Product find(UUID id) {
        return products.findById(id).orElseThrow(() -> new ResourceNotFoundException("Product", id));
    }
}
