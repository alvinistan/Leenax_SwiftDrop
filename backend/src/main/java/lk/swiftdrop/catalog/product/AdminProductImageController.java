package lk.swiftdrop.catalog.product;

import java.net.URI;
import java.util.UUID;
import lk.swiftdrop.catalog.product.AdminProductResponses.AdminImage;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Admin: product photos. Secured by the /api/admin/** rule (ADMIN only, CSRF token). */
@RestController
@RequestMapping("/api/admin/products/{productId}/images")
public class AdminProductImageController {

    private final ProductImageService imageService;

    public AdminProductImageController(ProductImageService imageService) {
        this.imageService = imageService;
    }

    /**
     * A multipart/form-data request with a "file" field and an optional "altText".
     * 201 with the image. 400 not a JPEG/PNG/WebP, 404 no such product,
     * 409 already 10 images, 413 file larger than 5 MB.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AdminImage> upload(
            @PathVariable UUID productId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(name = "altText", required = false) String altText) {
        AdminImage image = imageService.upload(productId, file, altText);
        return ResponseEntity.created(URI.create("/api/admin/products/" + productId + "/images/" + image.id()))
                .body(image);
    }

    /** 204, or 404 if the image does not exist or belongs to another product. */
    @DeleteMapping("/{imageId}")
    public ResponseEntity<Void> delete(@PathVariable UUID productId, @PathVariable UUID imageId) {
        imageService.delete(productId, imageId);
        return ResponseEntity.noContent().build();
    }
}
