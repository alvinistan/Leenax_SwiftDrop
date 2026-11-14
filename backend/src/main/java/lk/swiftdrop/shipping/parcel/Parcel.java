package lk.swiftdrop.shipping.parcel;

import java.math.BigDecimal;

/**
 * The packed parcel. Weights in kg (3 decimals), sizes in cm.
 *
 * @param boxName null when no box size is set up (then the size is unknown)
 * @param fits    false when the items are too big or heavy for every box (manual quote needed)
 */
public record Parcel(
        BigDecimal itemsWeightKg,
        BigDecimal packagingKg,
        BigDecimal actualWeightKg,
        String boxName,
        BigDecimal lengthCm,
        BigDecimal widthCm,
        BigDecimal heightCm,
        boolean fits) {

    public boolean hasDimensions() {
        return lengthCm != null && widthCm != null && heightCm != null;
    }
}
