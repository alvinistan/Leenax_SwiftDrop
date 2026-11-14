package lk.swiftdrop.shipping.pricing;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.math.BigDecimal;

/** "Up to {maxWeightKg} kg costs {price}." Part of a rate card. */
@Embeddable
public record RateBand(
        @Column(name = "max_weight_kg", nullable = false, precision = 10, scale = 3) BigDecimal maxWeightKg,
        @Column(name = "price", nullable = false, precision = 19, scale = 4) BigDecimal price) {
}
