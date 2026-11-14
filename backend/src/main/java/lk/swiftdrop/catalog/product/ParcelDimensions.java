package lk.swiftdrop.catalog.product;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.math.BigDecimal;

/**
 * Packed size of one unit, in centimetres (used for volumetric weight).
 * Stored in three columns of product_variants; when all three are empty,
 * Hibernate gives a null object (no dimensions known).
 */
@Embeddable
public record ParcelDimensions(
        @Column(name = "length_cm", precision = 8, scale = 1) BigDecimal lengthCm,
        @Column(name = "width_cm", precision = 8, scale = 1) BigDecimal widthCm,
        @Column(name = "height_cm", precision = 8, scale = 1) BigDecimal heightCm) {

    /** null when any side is missing (the request validation requires all three or none). */
    public static ParcelDimensions ofNullable(BigDecimal length, BigDecimal width, BigDecimal height) {
        return length == null || width == null || height == null ? null : new ParcelDimensions(length, width, height);
    }
}
