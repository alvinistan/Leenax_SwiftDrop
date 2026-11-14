package lk.swiftdrop.shipping.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import lk.swiftdrop.shipping.pricing.MarkupCalculator.Markup;
import org.junit.jupiter.api.Test;

class MarkupCalculatorTest {

    private static BigDecimal d(String value) {
        return value == null ? null : new BigDecimal(value);
    }

    private static Markup markup(MarkupType type, String percent, String fixed, String min, String max) {
        return new Markup(type, d(percent), d(fixed), d(min), d(max));
    }

    @Test
    void theOwnersExample_2PercentOf10000() {
        BigDecimal fee = MarkupCalculator.fee(d("10000.00"), markup(MarkupType.PERCENT, "2", null, null, null));

        assertThat(fee).isEqualTo(d("200.00"));
        assertThat(d("10000.00").add(fee)).isEqualByComparingTo("10200.00");
    }

    @Test
    void fixedAndCombinedFees() {
        assertThat(MarkupCalculator.fee(d("1000"), markup(MarkupType.FIXED, null, "150", null, null))).isEqualTo(d("150.00"));
        // 2 % of 1,000 = 20, + 150 = 170
        assertThat(MarkupCalculator.fee(d("1000"), markup(MarkupType.COMBINED, "2", "150", null, null))).isEqualTo(d("170.00"));
    }

    @Test
    void minimumAndMaximumFeesAreApplied() {
        // 2 % of 1,000 = 20 → raised to the 50 minimum
        assertThat(MarkupCalculator.fee(d("1000"), markup(MarkupType.PERCENT, "2", null, "50", "500"))).isEqualTo(d("50.00"));
        // 2 % of 100,000 = 2,000 → capped at 500
        assertThat(MarkupCalculator.fee(d("100000"), markup(MarkupType.PERCENT, "2", null, "50", "500"))).isEqualTo(d("500.00"));
    }

    @Test
    void zeroPercentPromotionCostsNothing() {
        assertThat(MarkupCalculator.fee(d("4500"), markup(MarkupType.PERCENT, "0", null, null, null))).isEqualTo(d("0.00"));
    }

    @Test
    void roundsHalfUpToCents() {
        // 2.5 % of 1,234.50 = 30.8625 → 30.86;  2.5 % of 1,234.70 = 30.8675 → 30.87
        assertThat(MarkupCalculator.fee(d("1234.50"), markup(MarkupType.PERCENT, "2.5", null, null, null))).isEqualTo(d("30.86"));
        assertThat(MarkupCalculator.fee(d("1234.70"), markup(MarkupType.PERCENT, "2.5", null, null, null))).isEqualTo(d("30.87"));
    }

    @Test
    void describesTheRuleForTheQuoteSnapshot() {
        assertThat(MarkupCalculator.describe("Default platform fee", markup(MarkupType.PERCENT, "2.00", null, null, null)))
                .isEqualTo("2% (Default platform fee)");
        assertThat(MarkupCalculator.describe("Promo", markup(MarkupType.COMBINED, "1.5", "100.0000", null, null)))
                .isEqualTo("1.5% + LKR 100 (Promo)");
    }
}
