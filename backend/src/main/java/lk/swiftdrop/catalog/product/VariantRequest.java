package lk.swiftdrop.catalog.product;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;

public record VariantRequest(
        @NotBlank(message = "SKU is required.")
        @Size(max = 64, message = "SKU must be at most 64 characters.")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$",
                message = "SKU may contain only letters, numbers, dots, hyphens and underscores.")
        String sku,

        @NotNull(message = "Price is required (per piece, or per kg for KG variants).")
        @DecimalMin(value = "0.00", message = "Price cannot be negative.")
        @Digits(integer = 15, fraction = 2, message = "Price must have at most 2 decimal places.")
        BigDecimal price,

        /** e.g. {"Size": "M", "Colour": "Red"}. Optional: a simple product has no options. */
        @Size(max = 5, message = "A variant can have at most 5 options.")
        Map<@NotBlank @Size(max = 50) String, @NotBlank @Size(max = 100) String> options,

        /** Optional; defaults to true. */
        Boolean active,

        /** Optional; defaults to PIECE. KG = price per kg, customer chooses the weight. */
        SaleUnit saleUnit,

        /** Optional; defaults: PIECE 1, KG 0.5. */
        @DecimalMin(value = "0.001", message = "Minimum quantity must be greater than 0.")
        @Digits(integer = 7, fraction = 3, message = "Minimum quantity can have at most 3 decimal places.")
        BigDecimal minQuantity,

        /** Optional; empty = no upper limit. */
        @DecimalMin(value = "0.001", message = "Maximum quantity must be greater than 0.")
        @Digits(integer = 7, fraction = 3, message = "Maximum quantity can have at most 3 decimal places.")
        BigDecimal maxQuantity,

        /** Optional; defaults: PIECE 1, KG 0.5. */
        @DecimalMin(value = "0.001", message = "Quantity step must be greater than 0.")
        @Digits(integer = 7, fraction = 3, message = "Quantity step can have at most 3 decimal places.")
        BigDecimal quantityStep) {

    public SaleUnit effectiveSaleUnit() {
        return Objects.requireNonNullElse(saleUnit, SaleUnit.PIECE);
    }

    /** The rules to store: values from the request, with defaults for anything left out. */
    public QuantityRules effectiveQuantityRules() {
        QuantityRules defaults = QuantityRules.defaultsFor(effectiveSaleUnit());
        return new QuantityRules(
                Objects.requireNonNullElse(minQuantity, defaults.minQuantity()),
                maxQuantity,
                Objects.requireNonNullElse(quantityStep, defaults.step()));
    }

    /** Cross-field rules. Reported as field "variants[i].quantityRulesValid". */
    @JsonIgnore
    @AssertTrue(message = "Maximum must not be below minimum, and PIECE variants need whole-number quantities.")
    public boolean isQuantityRulesValid() {
        QuantityRules rules = effectiveQuantityRules();
        if (rules.maxQuantity() != null && rules.maxQuantity().compareTo(rules.minQuantity()) < 0) {
            return false;
        }
        if (effectiveSaleUnit() == SaleUnit.PIECE) {
            return isWhole(rules.minQuantity()) && isWhole(rules.step())
                    && (rules.maxQuantity() == null || isWhole(rules.maxQuantity()));
        }
        return true;
    }

    private static boolean isWhole(BigDecimal value) {
        return value.stripTrailingZeros().scale() <= 0;
    }
}
