package lk.swiftdrop.payment;

import lk.swiftdrop.payment.PaymentService.CheckoutForm;
import lk.swiftdrop.payment.PaymentService.Outcome;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PaymentController {

    public record PaymentOptions(boolean card) {
    }

    private final PaymentService payments;

    public PaymentController(PaymentService payments) {
        this.payments = payments;
    }

    /** Public: is "Pay online by card" offered at checkout? */
    @GetMapping("/api/payments/options")
    public ResponseEntity<PaymentOptions> options() {
        return ResponseEntity.ok(new PaymentOptions(payments.cardPaymentsAvailable()));
    }

    /** The customer's own card order → the signed PayHere form (CUSTOMER, via /api/orders/**). */
    @PostMapping("/api/orders/{orderNumber}/payhere-checkout")
    public ResponseEntity<CheckoutForm> startCheckout(@AuthenticationPrincipal UserDetails user,
                                                      @PathVariable String orderNumber) {
        return ResponseEntity.ok(payments.startCheckout(user.getUsername(), orderNumber));
    }

    /**
     * PayHere's server-to-server notification (form-urlencoded). Public and
     * without CSRF token by necessity: its md5sig is the authentication.
     */
    @PostMapping(path = "/api/payments/payhere/notify", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Void> notify(@RequestParam MultiValueMap<String, String> form) {
        Outcome outcome = payments.handleNotification(form.toSingleValueMap());
        return outcome == Outcome.REJECTED ? ResponseEntity.badRequest().build() : ResponseEntity.ok().build();
    }
}
