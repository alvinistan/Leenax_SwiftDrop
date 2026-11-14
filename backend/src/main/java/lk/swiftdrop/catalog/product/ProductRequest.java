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

/**
 * Body of POST /api/admin/products and PUT /api/admin/products/{id}: a product
 * together with its variants. On PUT, variants with an id are updated, new ones
 * are added, and existing variants missing from the list are removed.
 */
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
        List<@NotNull @Valid VariantRequest> variants,

        /** Optional; defaults to GENERAL. */
        ShippingCategory shippingCategory,

        /** Harmonized System code for customs, e.g. 0305.59. Optional. */
        @Pattern(regexp = "^[0-9]{4}(\\.?[0-9]{2}){1,3}$",
                message = "Enter an HS code like 0305.59 or 1905.90.90 (6 to 10 digits).")
        String hsCode,

        /** Two-letter country code, e.g. LK. Optional; defaults to LK. */
        @Pattern(regexp = "^[A-Z]{2}$", message = "Use a two-letter country code, e.g. LK.")
        String countryOfOrigin,

        @Size(max = 200, message = "Customs description must be at most 200 characters.")
        String customsDescription) {

    public ShippingCategory effectiveShippingCategory() {
        return Objects.requireNonNullElse(shippingCategory, ShippingCategory.GENERAL);
    }

    public String effectiveCountryOfOrigin() {
        return Objects.requireNonNullElse(countryOfOrigin, "LK");
    }

    /** An ACTIVE product must have something customers can choose. Reported as "activeProductHasActiveVariant". */
    @JsonIgnore
    @AssertTrue(message = "An active product needs at least one active variant.")
    public boolean isActiveProductHasActiveVariant() {
        if (status != ProductStatus.ACTIVE || variants == null) {
            return true;
        }
        return variants.stream().anyMatch(v -> v != null && !Boolean.FALSE.equals(v.active()));
    }

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
