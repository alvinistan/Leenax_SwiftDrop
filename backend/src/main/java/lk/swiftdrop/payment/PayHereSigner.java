package lk.swiftdrop.payment;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;

/**
 * PayHere checksums, exactly as on the official Checkout API page
 * (support.payhere.lk, "Checkout API", last updated 4 Sep 2026):
 *
 * <pre>
 * hash   = UPPER(md5(merchant_id + order_id + amount + currency + UPPER(md5(merchant_secret))))
 *          amount formatted with 2 decimals and no thousands separator, e.g. 1000.00
 * md5sig = UPPER(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code
 *          + UPPER(md5(merchant_secret))))
 * </pre>
 *
 * MD5 is PayHere's choice for this checksum, not ours; it is used only to
 * compare with PayHere's value, never to store passwords.
 */
public final class PayHereSigner {

    private PayHereSigner() {
    }

    /** "1000.00": two decimals, no thousands separator, dot as decimal point. */
    public static String formatAmount(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.UNNECESSARY).toPlainString();
    }

    public static String checkoutHash(String merchantId, String orderId, BigDecimal amount, String currency,
                                      String merchantSecret) {
        return upperMd5(merchantId + orderId + formatAmount(amount) + currency + upperMd5(merchantSecret));
    }

    /** Uses the values exactly as PayHere sent them (strings), as the documentation shows. */
    public static String notificationSignature(String merchantId, String orderId, String payhereAmount,
                                               String payhereCurrency, String statusCode, String merchantSecret) {
        return upperMd5(merchantId + orderId + payhereAmount + payhereCurrency + statusCode + upperMd5(merchantSecret));
    }

    /** Constant-time comparison, so an attacker cannot guess a signature byte by byte from timings. */
    public static boolean matches(String expected, String received) {
        if (received == null) {
            return false;
        }
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
                received.trim().toUpperCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII));
    }

    static String upperMd5(String input) {
        try {
            byte[] digest = MessageDigest.getInstance("MD5").digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().withUpperCase().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("MD5 is always available in Java", e);
        }
    }
}
