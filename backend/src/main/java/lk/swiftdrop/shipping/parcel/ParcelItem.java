package lk.swiftdrop.shipping.parcel;

import java.math.BigDecimal;

/**
 * One line of an order, for packing: the packed weight (and optionally size)
 * of ONE sale unit, and how many units. For KG variants a "unit" is 1 kg sold,
 * so quantity can be 1.5.
 *
 * @param lengthCm null when the size is unknown (then all three are null)
 */
public record ParcelItem(
        String label,
        BigDecimal unitWeightKg,
        BigDecimal quantity,
        BigDecimal lengthCm,
        BigDecimal widthCm,
        BigDecimal heightCm) {

    boolean hasDimensions() {
        return lengthCm != null && widthCm != null && heightCm != null;
    }
}
