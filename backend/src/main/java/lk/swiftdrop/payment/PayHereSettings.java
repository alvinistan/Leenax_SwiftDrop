package lk.swiftdrop.payment;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * PayHere settings, from environment variables only (.env on your PC, a
 * secrets manager in production). The merchant secret is never logged, never
 * sent to the browser and never stored in Git.
 */
@Component
public class PayHereSettings {

    /** Official Checkout API action URLs (PayHere Checkout API page, 4 Sep 2026). */
    static final String SANDBOX_URL = "https://sandbox.payhere.lk/pay/checkout";
    static final String LIVE_URL = "https://www.payhere.lk/pay/checkout";

    private final String merchantId;
    private final String merchantSecret;
    private final boolean live;
    private final String publicApiBaseUrl;
    private final String frontendBaseUrl;

    public PayHereSettings(@Value("${app.payhere.merchant-id:}") String merchantId,
                           @Value("${app.payhere.merchant-secret:}") String merchantSecret,
                           @Value("${app.payhere.mode:sandbox}") String mode,
                           @Value("${app.payhere.public-api-base-url:}") String publicApiBaseUrl,
                           @Value("${app.payhere.frontend-base-url:http://localhost:5173}") String frontendBaseUrl) {
        this.merchantId = merchantId.trim();
        this.merchantSecret = merchantSecret.trim();
        this.live = "live".equalsIgnoreCase(mode.trim());
        this.publicApiBaseUrl = stripSlash(publicApiBaseUrl.trim());
        this.frontendBaseUrl = stripSlash(frontendBaseUrl.trim());
    }

    /** Card payments are offered only when everything PayHere needs is set. */
    public boolean isConfigured() {
        return !merchantId.isEmpty() && !merchantSecret.isEmpty() && !publicApiBaseUrl.isEmpty();
    }

    public boolean isLive() {
        return live;
    }

    String actionUrl() {
        return live ? LIVE_URL : SANDBOX_URL;
    }

    String merchantId() {
        return merchantId;
    }

    /** Package-private: only the signer uses it. */
    String merchantSecret() {
        return merchantSecret;
    }

    /** PayHere calls this server to server; it must be a public https address (not localhost). */
    String notifyUrl() {
        return publicApiBaseUrl + "/api/payments/payhere/notify";
    }

    String returnUrl(String orderNumber) {
        return frontendBaseUrl + "/account/orders/" + orderNumber + "?payment=return";
    }

    String cancelUrl(String orderNumber) {
        return frontendBaseUrl + "/account/orders/" + orderNumber + "?payment=cancelled";
    }

    private static String stripSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    @Override
    public String toString() {
        // Never print the secret (e.g. in logs or error messages).
        return "PayHereSettings[merchantId=" + merchantId + ", live=" + live + ", configured=" + isConfigured() + "]";
    }
}
