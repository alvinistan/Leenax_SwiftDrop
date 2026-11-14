package lk.swiftdrop.shipping.parcel;

import java.math.BigDecimal;

/** A box size the shop packs with: inside size, empty weight, and an optional weight limit. */
public record BoxSpec(
        String name,
        BigDecimal lengthCm,
        BigDecimal widthCm,
        BigDecimal heightCm,
        BigDecimal emptyWeightKg,
        BigDecimal maxWeightKg) {
}
