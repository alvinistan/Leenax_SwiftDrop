package lk.swiftdrop.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/**
 * Expected values were computed independently (Python hashlib) from the
 * formulas on the official PayHere Checkout API page, not with this code.
 */
class PayHereSignerTest {

    private static final String SECRET = "test-secret-value";

    @Test
    void checkoutHashFollowsPayHeresFormula() {
        assertThat(PayHereSigner.checkoutHash("1211149", "SD-001001", new BigDecimal("2921.00"), "LKR", SECRET))
                .isEqualTo("833CCBB994CF469A67DA81EF9612D42C");
        // 1000 is sent as "1000.00" (two decimals, no thousands separator)
        assertThat(PayHereSigner.checkoutHash("1211149", "ItemNo12345", new BigDecimal("1000"), "LKR", SECRET))
                .isEqualTo("75B61498700477ECB629450A874EAC0D");
    }

    @Test
    void notificationSignatureFollowsPayHeresFormula() {
        String sig = PayHereSigner.notificationSignature("1211149", "SD-001001", "2921.00", "LKR", "2", SECRET);
        assertThat(sig).isEqualTo("1207C6CEAB81F7AAAE80349F43E2154A");
        assertThat(PayHereSigner.matches(sig, "1207c6ceab81f7aaae80349f43e2154a")).isTrue(); // case-insensitive
        assertThat(PayHereSigner.matches(sig, "1207C6CEAB81F7AAAE80349F43E2154B")).isFalse();
        assertThat(PayHereSigner.matches(sig, null)).isFalse();
    }

    @Test
    void amountsAreNeverRoundedSilently() {
        assertThat(PayHereSigner.formatAmount(new BigDecimal("12345.5"))).isEqualTo("12345.50");
        assertThatThrownBy(() -> PayHereSigner.formatAmount(new BigDecimal("1.005")))
                .isInstanceOf(ArithmeticException.class);
    }

    @Test
    void namesAreSplitForPayHeresFirstAndLastName() {
        assertThat(PaymentService.splitName("Kamala Devi Rajan")).containsExactly("Kamala Devi", "Rajan");
        assertThat(PaymentService.splitName("Kamala")).containsExactly("Kamala", "Kamala");
    }

    @Test
    void theSecretIsNeverPrinted() {
        PayHereSettings settings = new PayHereSettings("1211149", SECRET, "sandbox", "https://api.example.test/", "");
        assertThat(settings.toString()).doesNotContain(SECRET);
        assertThat(settings.isConfigured()).isTrue();
        assertThat(settings.notifyUrl()).isEqualTo("https://api.example.test/api/payments/payhere/notify");
        assertThat(settings.actionUrl()).isEqualTo("https://sandbox.payhere.lk/pay/checkout");
    }
}
