package lk.swiftdrop.common.money;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Currency;

/**
 * Money as sent to clients: the amount as a decimal STRING (so no client turns
 * it into an inexact floating-point number) and an ISO 4217 currency code.
 * Example: { "amount": "1450.00", "currency": "LKR" }
 */
public record MoneyResponse(String amount, String currency) {

    public static MoneyResponse of(BigDecimal amount, String currencyCode) {
        // LKR and USD use 2 decimal places; some currencies use 0 or 3.
        int decimals = Currency.getInstance(currencyCode).getDefaultFractionDigits();
        return new MoneyResponse(
                amount.setScale(decimals, RoundingMode.HALF_UP).toPlainString(), currencyCode);
    }
}
