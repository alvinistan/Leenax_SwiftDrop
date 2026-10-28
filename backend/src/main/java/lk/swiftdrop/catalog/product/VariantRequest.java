package lk.swiftdrop.catalog.product;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.Map;

public record VariantRequest(
        @NotBlank(message = "SKU is required.")
        @Size(max = 64, message = "SKU must be at most 64 characters.")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$",
                message = "SKU may contain only letters, numbers, dots, hyphens and underscores.")
        String sku,

        @NotNull(message = "Price is required.")
        @DecimalMin(value = "0.00", message = "Price cannot be negative.")
        @Digits(integer = 15, fraction = 2, message = "Price must have at most 2 decimal places.")
        BigDecimal price,

        /** e.g. {"Size": "M", "Colour": "Red"}. Optional: a simple product has no options. */
        @Size(max = 5, message = "A variant can have at most 5 options.")
        Map<@NotBlank @Size(max = 50) String, @NotBlank @Size(max = 100) String> options,

        /** Optional; defaults to true. */
        Boolean active) {
}
