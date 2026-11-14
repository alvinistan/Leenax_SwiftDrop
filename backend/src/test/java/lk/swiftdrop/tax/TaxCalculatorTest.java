package lk.swiftdrop.tax;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class TaxCalculatorTest {

    private static BigDecimal tax(String gross, String percent) {
        return TaxCalculator.includedTax(new BigDecimal(gross), percent == null ? null : new BigDecimal(percent));
    }

    @Test
    void findsTheTaxInsideATaxInclusivePrice() {
        assertThat(tax("1180.00", "18")).isEqualByComparingTo("180.00"); // 1180 × 18 / 118
        assertThat(tax("100.00", "18")).isEqualByComparingTo("15.25");   // 15.254… → 15.25
        assertThat(tax("2500.00", "2.5")).isEqualByComparingTo("60.98"); // 60.975… → 60.98 (half up)
    }

    @Test
    void noRateMeansNoTax() {
        assertThat(tax("999.99", null)).isEqualByComparingTo("0.00");
        assertThat(tax("999.99", "0")).isEqualByComparingTo("0.00");
    }
}
