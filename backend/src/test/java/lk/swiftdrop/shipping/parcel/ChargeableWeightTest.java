package lk.swiftdrop.shipping.parcel;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class ChargeableWeightTest {

    private static BigDecimal d(String value) {
        return new BigDecimal(value);
    }

    private static Parcel box(String l, String w, String h, String actual) {
        return new Parcel(d(actual), BigDecimal.ZERO, d(actual), "Box", d(l), d(w), d(h), true);
    }

    @Test
    void theDesignDocumentExample() {
        // 30×20×15 cm = 9,000 cm³ ÷ 5,000 = 1.8 kg; actual 1.5 kg; 0.5 kg steps → 2.0 kg
        Parcel parcel = box("30", "20", "15", "1.5");
        BigDecimal volumetric = ChargeableWeight.volumetric(parcel, 5000);

        assertThat(volumetric).isEqualByComparingTo("1.8");
        assertThat(ChargeableWeight.chargeable(parcel.actualWeightKg(), volumetric, d("0.5"))).isEqualByComparingTo("2.0");
    }

    @Test
    void eachCourierUsesItsOwnDivisorAndRounding() {
        Parcel parcel = box("30", "20", "15", "1.5");

        // divisor 4,000 → 2.25 kg; 1 kg steps → 3 kg
        assertThat(ChargeableWeight.chargeable(d("1.5"), ChargeableWeight.volumetric(parcel, 4000), d("1")))
                .isEqualByComparingTo("3");
        // a courier without volumetric pricing charges actual weight: 1.5 → 2 kg with 1 kg steps
        assertThat(ChargeableWeight.volumetric(parcel, null)).isNull();
        assertThat(ChargeableWeight.chargeable(d("1.5"), null, d("1"))).isEqualByComparingTo("2");
    }

    @Test
    void anExactMultipleIsNotRoundedFurther() {
        assertThat(ChargeableWeight.chargeable(d("2.000"), d("1.2"), d("0.5"))).isEqualByComparingTo("2.0");
    }

    @Test
    void anUnknownSizeGivesNoVolumetricWeight() {
        Parcel noSize = new Parcel(d("1"), BigDecimal.ZERO, d("1"), null, null, null, null, true);
        assertThat(ChargeableWeight.volumetric(noSize, 5000)).isNull();
    }
}
