package lk.swiftdrop.shipping.pricing;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * The platform shipping fee. Pure Java, exact decimals (BigDecimal):
 *
 * <pre>
 * fee = courier price × percent / 100 (PERCENT, COMBINED)
 *     + fixed amount                  (FIXED, COMBINED)
 *     → kept between the minimum and maximum fee, if set
 *     → rounded half-up to 2 decimals (LKR cents)
 * customer price = courier price + fee
 * </pre>
 * Example: LKR 10,000.00 at 2 % → fee LKR 200.00 → customer pays LKR 10,200.00.
 */
public final class MarkupCalculator {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private MarkupCalculator() {
    }

    public record Markup(MarkupType type, BigDecimal percent, BigDecimal fixedAmount, BigDecimal minFee, BigDecimal maxFee) {
    }

    public static BigDecimal fee(BigDecimal courierPrice, Markup markup) {
        BigDecimal fee = BigDecimal.ZERO;
        if (markup.type() != MarkupType.FIXED) {
            fee = fee.add(courierPrice.multiply(markup.percent()).divide(HUNDRED));
        }
        if (markup.type() != MarkupType.PERCENT) {
            fee = fee.add(markup.fixedAmount());
        }
        if (markup.minFee() != null && fee.compareTo(markup.minFee()) < 0) {
            fee = markup.minFee();
        }
        if (markup.maxFee() != null && fee.compareTo(markup.maxFee()) > 0) {
            fee = markup.maxFee();
        }
        return fee.setScale(2, RoundingMode.HALF_UP);
    }

    /** A short, human-readable summary saved with each quote, e.g. "2% (Default platform fee)". */
    public static String describe(String ruleName, Markup markup) {
        String how = switch (markup.type()) {
            case PERCENT -> plain(markup.percent()) + "%";
            case FIXED -> "LKR " + plain(markup.fixedAmount());
            case COMBINED -> plain(markup.percent()) + "% + LKR " + plain(markup.fixedAmount());
        };
        return how + " (" + ruleName + ")";
    }

    private static String plain(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }
}
