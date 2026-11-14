package lk.swiftdrop.shipping.parcel;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class ParcelCalculatorTest {

    private static BigDecimal d(String value) {
        return new BigDecimal(value);
    }

    private static final List<BoxSpec> BOXES = List.of(
            new BoxSpec("Large", d("45"), d("35"), d("25"), d("0.600"), d("25")),
            new BoxSpec("Small", d("20"), d("15"), d("10"), d("0.200"), d("3")),
            new BoxSpec("Medium", d("30"), d("25"), d("15"), d("0.350"), d("10")));

    private static ParcelItem item(String weight, String qty, String l, String w, String h) {
        return new ParcelItem("item", d(weight), d(qty), l == null ? null : d(l), w == null ? null : d(w), h == null ? null : d(h));
    }

    @Test
    void weighsItemsAndPicksTheSmallestBoxThatFits() {
        // 2 cakes of 1.3 kg in 22×20×10 cm boxes (8,800 cm³): too long for Small; Medium holds 80 % × 11,250 = 9,000 cm³
        Parcel parcel = ParcelCalculator.pack(List.of(item("1.3", "2", "22", "20", "10")), BOXES, d("0.25"));

        assertThat(parcel.itemsWeightKg()).isEqualByComparingTo("2.6");
        assertThat(parcel.boxName()).isEqualTo("Medium");
        assertThat(parcel.actualWeightKg()).isEqualByComparingTo("2.95"); // 2.6 + 0.35 box
        assertThat(parcel.fits()).isTrue();
    }

    @Test
    void kilogramItemsUseTheOrderedWeight() {
        // 1.5 kg of dried fish, packed weight 1.05 kg per kg sold → 1.575 kg
        Parcel parcel = ParcelCalculator.pack(List.of(item("1.05", "1.5", null, null, null)), BOXES, d("0.25"));

        assertThat(parcel.itemsWeightKg()).isEqualByComparingTo("1.575");
        assertThat(parcel.boxName()).isEqualTo("Small"); // no size given → smallest box by weight
    }

    @Test
    void anItemRotatedToFitStillFits() {
        // 10×25×18 fits Medium (30×25×15) when turned: sorted 10,18,25 ≤ 15,25,30
        Parcel parcel = ParcelCalculator.pack(List.of(item("1", "1", "10", "25", "18")), BOXES, d("0.25"));
        assertThat(parcel.boxName()).isEqualTo("Medium");
    }

    @Test
    void tooBigOrTooHeavyForEveryBoxNeedsAManualQuote() {
        Parcel tooLong = ParcelCalculator.pack(List.of(item("1", "1", "80", "10", "10")), BOXES, d("0.25"));
        Parcel tooHeavy = ParcelCalculator.pack(List.of(item("30", "1", null, null, null)), BOXES, d("0.25"));

        assertThat(tooLong.fits()).isFalse();
        assertThat(tooHeavy.fits()).isFalse();
    }

    @Test
    void withoutBoxSizesTheDefaultPackagingIsUsedAndTheSizeIsUnknown() {
        Parcel parcel = ParcelCalculator.pack(List.of(item("1.2", "1", null, null, null)), List.of(), d("0.25"));

        assertThat(parcel.actualWeightKg()).isEqualByComparingTo("1.45");
        assertThat(parcel.hasDimensions()).isFalse();
    }

    @Test
    void weightsAreRoundedUpNeverDown() {
        // 0.333 kg × 1.5 = 0.4995 → 0.500 (never under-declare to a courier)
        Parcel parcel = ParcelCalculator.pack(List.of(item("0.333", "1.5", null, null, null)), List.of(), d("0"));
        assertThat(parcel.itemsWeightKg()).isEqualByComparingTo("0.500");
    }
}
