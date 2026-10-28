package lk.swiftdrop.catalog.product;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Body of POST /api/admin/products: a product together with its variants. */
public record ProductRequest(
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
        ProductStatus status,

        /** @Valid: also validate every VariantRequest inside the list. */
        @NotEmpty(message = "A product needs at least one variant.")
        @Size(max = 100, message = "A product can have at most 100 variants.")
        List<@NotNull @Valid VariantRequest> variants) {

    /** Cross-field rule: SKUs must be unique within the request. Reported as field "variantSkusUnique". */
    @JsonIgnore
    @AssertTrue(message = "Each variant must have a different SKU.")
    public boolean isVariantSkusUnique() {
        if (variants == null) {
            return true;
        }
        List<String> skus = variants.stream().filter(Objects::nonNull).map(VariantRequest::sku).toList();
        return skus.stream().distinct().count() == skus.size();
    }
}
