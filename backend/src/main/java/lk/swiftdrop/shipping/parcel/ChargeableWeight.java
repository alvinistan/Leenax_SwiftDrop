package lk.swiftdrop.shipping.parcel;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Courier weight rules. Each courier has its OWN divisor and rounding (from the
 * contract), so they are parameters, never hard-coded.
 */
public final class ChargeableWeight {

    private ChargeableWeight() {
    }

    /**
     * Volumetric ("dimensional") weight = L × W × H (cm) ÷ divisor, rounded UP to grams.
     * null if the courier doesn't use it (divisor null) or the parcel size is unknown.
     */
    public static BigDecimal volumetric(Parcel parcel, Integer divisor) {
        if (divisor == null || !parcel.hasDimensions()) {
            return null;
        }
        return parcel.lengthCm().multiply(parcel.widthCm()).multiply(parcel.heightCm())
                .divide(BigDecimal.valueOf(divisor), 3, RoundingMode.CEILING);
    }

    /**
     * The weight the courier charges for: the larger of actual and volumetric
     * weight, rounded UP to the next multiple of the increment (e.g. 1.8 → 2.0
     * with 0.5 kg steps).
     */
    public static BigDecimal chargeable(BigDecimal actualKg, BigDecimal volumetricKg, BigDecimal incrementKg) {
        BigDecimal heavier = volumetricKg == null ? actualKg : actualKg.max(volumetricKg);
        BigDecimal steps = heavier.divide(incrementKg, 0, RoundingMode.CEILING);
        return steps.multiply(incrementKg).setScale(3, RoundingMode.UNNECESSARY);
    }
}
