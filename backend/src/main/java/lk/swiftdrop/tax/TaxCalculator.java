package lk.swiftdrop.tax;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Prices INCLUDE tax (owner decision D-9). The tax inside a gross amount is
 * gross × rate / (100 + rate). Example: LKR 1,180 with VAT 18% contains
 * 1,180 × 18 / 118 = LKR 180.00 of VAT. Rounded half-up to cents, per line.
 */
public final class TaxCalculator {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private TaxCalculator() {
    }

    public static BigDecimal includedTax(BigDecimal grossAmount, BigDecimal percent) {
        if (percent == null || percent.signum() == 0) {
            return BigDecimal.ZERO.setScale(2);
        }
        return grossAmount.multiply(percent).divide(HUNDRED.add(percent), 2, RoundingMode.HALF_UP);
    }
}
