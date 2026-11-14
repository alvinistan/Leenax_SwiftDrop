package lk.swiftdrop.shipping.parcel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

/**
 * Packs order items into one parcel and works out its weights. Pure Java: no
 * database, no Spring, so every rule is easy to unit-test.
 *
 * <ul>
 *   <li>Items weight = Σ unit weight × quantity (rounded UP: never under-declare).</li>
 *   <li>Box = the smallest enabled box that holds the items: enough volume (with
 *       {@link #PACKING_EFFICIENCY} for gaps), the largest item fits in some
 *       orientation, and the weight limit is respected.</li>
 *   <li>Actual weight = items + the empty box.</li>
 * </ul>
 */
public final class ParcelCalculator {

    /** Items rarely fill a box completely; assume 80 % of the inside volume is usable. */
    public static final BigDecimal PACKING_EFFICIENCY = new BigDecimal("0.80");

    private static final int WEIGHT_SCALE = 3;

    private ParcelCalculator() {
    }

    /**
     * @param boxes              enabled box sizes (may be empty)
     * @param defaultPackagingKg used when no boxes are set up
     */
    public static Parcel pack(List<ParcelItem> items, List<BoxSpec> boxes, BigDecimal defaultPackagingKg) {
        BigDecimal itemsWeight = items.stream()
                .map(i -> i.unitWeightKg().multiply(i.quantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(WEIGHT_SCALE, RoundingMode.CEILING);

        if (boxes.isEmpty()) {
            // Size unknown: couriers that charge by volume cannot be quoted automatically.
            return new Parcel(itemsWeight, defaultPackagingKg, itemsWeight.add(defaultPackagingKg),
                    null, null, null, null, true);
        }

        BigDecimal itemsVolume = items.stream()
                .filter(ParcelItem::hasDimensions)
                .map(i -> i.lengthCm().multiply(i.widthCm()).multiply(i.heightCm()).multiply(i.quantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return boxes.stream()
                .sorted(Comparator.comparing(ParcelCalculator::volume))
                .filter(box -> volume(box).multiply(PACKING_EFFICIENCY).compareTo(itemsVolume) >= 0)
                .filter(box -> items.stream().filter(ParcelItem::hasDimensions).allMatch(item -> fitsInside(item, box)))
                .filter(box -> box.maxWeightKg() == null
                        || itemsWeight.add(box.emptyWeightKg()).compareTo(box.maxWeightKg()) <= 0)
                .findFirst()
                .map(box -> new Parcel(itemsWeight, box.emptyWeightKg(), itemsWeight.add(box.emptyWeightKg()),
                        box.name(), box.lengthCm(), box.widthCm(), box.heightCm(), true))
                .orElseGet(() -> new Parcel(itemsWeight, defaultPackagingKg, itemsWeight.add(defaultPackagingKg),
                        null, null, null, null, false));
    }

    private static BigDecimal volume(BoxSpec box) {
        return box.lengthCm().multiply(box.widthCm()).multiply(box.heightCm());
    }

    /** Sorting both sets of sides compares them in the best orientation. */
    private static boolean fitsInside(ParcelItem item, BoxSpec box) {
        BigDecimal[] itemSides = sorted(item.lengthCm(), item.widthCm(), item.heightCm());
        BigDecimal[] boxSides = sorted(box.lengthCm(), box.widthCm(), box.heightCm());
        for (int i = 0; i < 3; i++) {
            if (itemSides[i].compareTo(boxSides[i]) > 0) {
                return false;
            }
        }
        return true;
    }

    private static BigDecimal[] sorted(BigDecimal a, BigDecimal b, BigDecimal c) {
        BigDecimal[] sides = {a, b, c};
        Arrays.sort(sides);
        return sides;
    }
}
