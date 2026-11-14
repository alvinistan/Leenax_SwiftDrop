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
import java.util.UUID;

public record VariantRequest(
        /** Set when editing an existing variant; empty for a new one. */
        UUID id,

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
        BigDecimal quantityStep,

        /** Optional; defaults to 0. Pieces, or kg for KG variants. */
        @DecimalMin(value = "0", message = "Stock cannot be negative.")
        @Digits(integer = 9, fraction = 3, message = "Stock can have at most 3 decimal places.")
        BigDecimal stockQuantity,

        /** Packed weight of one sale unit in kg (one piece, or one kg sold). Optional for now. */
        @DecimalMin(value = "0.001", message = "Shipping weight must be more than 0.")
        @Digits(integer = 7, fraction = 3, message = "Shipping weight can have at most 3 decimal places.")
        BigDecimal shippingWeightKg,

        /** Packed size of one unit in cm. Optional: all three or none. */
        @DecimalMin(value = "0.1", message = "Length must be more than 0.")
        @Digits(integer = 7, fraction = 1, message = "Length can have at most 1 decimal place.")
        BigDecimal lengthCm,

        @DecimalMin(value = "0.1", message = "Width must be more than 0.")
        @Digits(integer = 7, fraction = 1, message = "Width can have at most 1 decimal place.")
        BigDecimal widthCm,

        @DecimalMin(value = "0.1", message = "Height must be more than 0.")
        @Digits(integer = 7, fraction = 1, message = "Height can have at most 1 decimal place.")
        BigDecimal heightCm) {

    /** Cross-field rule: give all three sides or none. Reported as "variants[i].dimensionsComplete". */
    @JsonIgnore
    @AssertTrue(message = "Enter length, width and height together, or leave all three empty.")
    public boolean isDimensionsComplete() {
        int given = (lengthCm != null ? 1 : 0) + (widthCm != null ? 1 : 0) + (heightCm != null ? 1 : 0);
        return given == 0 || given == 3;
    }

    public ParcelDimensions dimensions() {
        return ParcelDimensions.ofNullable(lengthCm, widthCm, heightCm);
    }

    public BigDecimal effectiveStockQuantity() {
        return Objects.requireNonNullElse(stockQuantity, BigDecimal.ZERO);
    }

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
        if (effectiveSaleUnit() == SaleUnit.PIECE && !isWhole(effectiveStockQuantity())) {
            return false;
        }
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
