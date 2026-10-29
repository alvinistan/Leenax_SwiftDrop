package lk.swiftdrop.catalog.product;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.math.BigDecimal;

/**
 * Which quantities a customer may order of a variant. Stored as three columns
 * of product_variants (an @Embeddable is part of its owner's row, not a table).
 *
 * <p>Examples: pieces → min 1, step 1 (1, 2, 3 ...);
 * cake by weight → min 0.5, max 5, step 0.5 (0.5, 1.0, 1.5 ... 5.0 kg).
 */
@Embeddable
public record QuantityRules(
        @Column(name = "min_quantity", nullable = false, precision = 10, scale = 3)
        BigDecimal minQuantity,

        /** null = no upper limit */
        @Column(name = "max_quantity", precision = 10, scale = 3)
        BigDecimal maxQuantity,

        @Column(name = "quantity_step", nullable = false, precision = 10, scale = 3)
        BigDecimal step) {

    public static QuantityRules defaultsFor(SaleUnit unit) {
        return switch (unit) {
            case PIECE -> new QuantityRules(BigDecimal.ONE, null, BigDecimal.ONE);
            case KG -> new QuantityRules(new BigDecimal("0.5"), null, new BigDecimal("0.5"));
        };
    }

    /**
     * Is this quantity allowed? Used by the cart (Phase 8), on the server, so a
     * customer cannot order 0.3 kg when the step is 0.5 kg.
     */
    public boolean allows(BigDecimal quantity) {
        if (quantity == null || quantity.compareTo(minQuantity) < 0) {
            return false;
        }
        if (maxQuantity != null && quantity.compareTo(maxQuantity) > 0) {
            return false;
        }
        // (quantity - min) must be a whole number of steps
        return quantity.subtract(minQuantity).remainder(step).signum() == 0;
    }
}
