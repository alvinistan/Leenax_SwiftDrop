package lk.swiftdrop.catalog.product;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body of PUT /api/admin/products/{id}: replaces the product's own fields.
 * Variants are managed separately (admin screens in Phase 6).
 */
public record ProductUpdateRequest(
        @NotNull(message = "Category is required.")
        UUID categoryId,

        @NotBlank(message = "Name is required.")
        @Size(max = 200, message = "Name must be at most 200 characters.")
        String name,

        @NotBlank(message = "Slug is required.")
        @Size(max = 200, message = "Slug must be at most 200 characters.")
        @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$",
                message = "Slug may contain only lowercase letters, numbers and single hyphens, e.g. cotton-t-shirt.")
        String slug,

        @Size(max = 5000, message = "Description must be at most 5000 characters.")
        String description,

        @NotNull(message = "Status is required (DRAFT, ACTIVE or ARCHIVED).")
        ProductStatus status) {
}
