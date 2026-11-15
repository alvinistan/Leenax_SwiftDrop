package lk.swiftdrop.payment;

import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.identity.User;
import lk.swiftdrop.identity.UserRepository;
import lk.swiftdrop.order.CustomerOrder;
import lk.swiftdrop.order.DeliveryAddress;
import lk.swiftdrop.order.OrderRepository;
import lk.swiftdrop.order.OrderStatus;
import lk.swiftdrop.order.PaymentMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Online card payments with PayHere (Checkout API). The order is marked paid
 * ONLY after a notification whose md5sig, merchant id, amount and currency
 * all check out. The browser's return to our site proves nothing.
 */
@Service
@Transactional(readOnly = true)
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    static final String PROVIDER = "PAYHERE";
    static final String ACTOR = "PayHere";

    /** What the browser posts to PayHere (a hidden form). Contains the hash, never the secret. */
    public record CheckoutForm(String actionUrl, Map<String, String> fields) {
    }

    /** What happened to a notification (for the response code and tests). */
    public enum Outcome { APPLIED, DUPLICATE, REJECTED }

    public record PaymentView(UUID id, String provider, Payment.Status status, String amount, String currency,
                              String providerPaymentId, String method, String message, java.time.Instant createdAt,
                              java.time.Instant updatedAt) {

        static PaymentView of(Payment p) {
            return new PaymentView(p.getId(), p.getProvider(), p.getStatus(), PayHereSigner.formatAmount(p.getAmount()),
                    p.getCurrency(), p.getProviderPaymentId(), p.getProviderMethod(), p.getProviderMessage(),
                    p.getCreatedAt(), p.getUpdatedAt());
        }
    }

    private final PayHereSettings settings;
    private final PaymentRepository payments;
    private final OrderRepository orders;
    private final UserRepository users;

    public PaymentService(PayHereSettings settings, PaymentRepository payments, OrderRepository orders,
                          UserRepository users) {
        this.settings = settings;
        this.payments = payments;
        this.orders = orders;
        this.users = users;
    }

    public boolean cardPaymentsAvailable() {
        return settings.isConfigured();
    }

    /** Payment attempts of an order, oldest first (admin view). */
    public List<PaymentView> paymentsOf(UUID orderId) {
        return payments.findAllByOrderIdOrderByCreatedAtAsc(orderId).stream().map(PaymentView::of).toList();
    }

    /** Starts (or restarts) paying a card order: a new attempt and the signed form for PayHere. */
    @Transactional
    public CheckoutForm startCheckout(String customerEmail, String orderNumber) {
        if (!settings.isConfigured()) {
            throw new BadRequestException("Card payments are not available right now.");
        }
        User customer = users.findByEmail(customerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", customerEmail));
        CustomerOrder order = orders.findByOrderNumberAndCustomerId(orderNumber, customer.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderNumber));
        if (order.getPaymentMethod() != PaymentMethod.CARD) {
            throw new BadRequestException("This order is not paid by card.");
        }
        if (order.getPaymentStatus() == CustomerOrder.PaymentStatus.PAID) {
            throw new BadRequestException("This order is already paid.");
        }
        if (order.getStatus() != OrderStatus.PLACED && order.getStatus() != OrderStatus.CONFIRMED) {
            throw new BadRequestException("This order can no longer be paid online.");
        }

        Payment attempt = payments.saveAndFlush(Payment.started(order, PROVIDER));
        DeliveryAddress a = order.getAddress();
        String[] names = splitName(a.recipientName());
        // Field names exactly as on the PayHere Checkout API page.
        Map<String, String> f = new LinkedHashMap<>();
        f.put("merchant_id", settings.merchantId());
        f.put("return_url", settings.returnUrl(order.getOrderNumber()));
        f.put("cancel_url", settings.cancelUrl(order.getOrderNumber()));
        f.put("notify_url", settings.notifyUrl());
        f.put("first_name", names[0]);
        f.put("last_name", names[1]);
        f.put("email", customer.getEmail());
        f.put("phone", a.phone());
        f.put("address", a.line2() == null ? a.line1() : a.line1() + ", " + a.line2());
        f.put("city", a.city());
        f.put("country", Locale.of("", a.countryCode()).getDisplayCountry(Locale.ENGLISH));
        f.put("order_id", order.getOrderNumber());
        f.put("items", "Order " + order.getOrderNumber());
        f.put("currency", order.getCurrency());
        f.put("amount", PayHereSigner.formatAmount(order.getGrandTotal()));
        f.put("custom_1", attempt.getId().toString());
        f.put("hash", PayHereSigner.checkoutHash(settings.merchantId(), order.getOrderNumber(), order.getGrandTotal(),
                order.getCurrency(), settings.merchantSecret()));
        return new CheckoutForm(settings.actionUrl(), f);
    }

    /**
     * PayHere's server-to-server notification. Nothing is trusted until the
     * md5sig matches; then merchant, order, amount and currency must match too.
     */
    @Transactional
    public Outcome handleNotification(Map<String, String> p) {
        if (!settings.isConfigured()) {
            return Outcome.REJECTED;
        }
        String merchantId = p.get("merchant_id");
        String orderNumber = p.get("order_id");
        String amount = p.get("payhere_amount");
        String currency = p.get("payhere_currency");
        String statusCode = p.get("status_code");
        if (merchantId == null || orderNumber == null || amount == null || currency == null || statusCode == null) {
            log.warn("PayHere notification rejected: fields missing");
            return Outcome.REJECTED;
        }
        String expected = PayHereSigner.notificationSignature(merchantId, orderNumber, amount, currency, statusCode,
                settings.merchantSecret());
        if (!PayHereSigner.matches(expected, p.get("md5sig")) || !settings.merchantId().equals(merchantId)) {
            log.warn("PayHere notification rejected: invalid signature or merchant (order {})", safe(orderNumber));
            return Outcome.REJECTED;
        }
        Optional<CustomerOrder> found = orders.findByOrderNumber(orderNumber);
        if (found.isEmpty()) {
            log.warn("PayHere notification rejected: unknown order {}", safe(orderNumber));
            return Outcome.REJECTED;
        }
        CustomerOrder order = found.get();
        BigDecimal paid;
        try {
            paid = new BigDecimal(amount);
        } catch (NumberFormatException e) {
            return Outcome.REJECTED;
        }
        if (paid.compareTo(order.getGrandTotal()) != 0 || !order.getCurrency().equals(currency)) {
            order.addInternalNote("PayHere reported " + currency + " " + amount
                    + ", which does not match the order total. Not marked as paid: check with PayHere.", ACTOR);
            log.warn("PayHere notification rejected: amount or currency mismatch (order {})", orderNumber);
            return Outcome.REJECTED;
        }
        int code;
        try {
            code = Integer.parseInt(statusCode.trim());
        } catch (NumberFormatException e) {
            return Outcome.REJECTED;
        }
        Payment.Status status = switch (code) {
            case 2 -> Payment.Status.SUCCEEDED;
            case 0 -> Payment.Status.PENDING;
            case -1 -> Payment.Status.CANCELLED;
            case -2 -> Payment.Status.FAILED;
            case -3 -> Payment.Status.CHARGED_BACK;
            default -> null;
        };
        if (status == null) {
            return Outcome.REJECTED;
        }

        Payment attempt = attemptFor(order, p.get("custom_1"));
        if (attempt.getStatus() == status && p.get("payment_id") != null
                && p.get("payment_id").equals(attempt.getProviderPaymentId())) {
            return Outcome.DUPLICATE; // PayHere may notify more than once
        }
        attempt.record(status, truncate(p.get("payment_id"), 40), truncate(p.get("method"), 20), code,
                truncate(p.get("status_message"), 300));

        String reference = "PayHere payment " + (attempt.getProviderPaymentId() == null ? "" : attempt.getProviderPaymentId());
        if (status == Payment.Status.SUCCEEDED && order.getPaymentStatus() == CustomerOrder.PaymentStatus.UNPAID) {
            if (order.getStatus() == OrderStatus.CANCELLED) {
                // Paid after the order was cancelled (e.g. it timed out): the owner must refund it.
                order.addInternalNote(reference + " received after the order was cancelled. Refund it in PayHere.",
                        ACTOR);
            } else {
                order.markPaid("Paid online by card (" + reference.trim() + ")", ACTOR);
            }
        } else if (status == Payment.Status.CHARGED_BACK) {
            order.reversePayment("Charge-back from PayHere (" + reference.trim() + "). The order is unpaid again.",
                    ACTOR);
        }
        orders.flush();
        return Outcome.APPLIED;
    }

    /** The attempt named in custom_1 (if it belongs to this order), else the latest one, else a new one. */
    private Payment attemptFor(CustomerOrder order, String custom1) {
        if (custom1 != null) {
            try {
                Optional<Payment> named = payments.findById(UUID.fromString(custom1.trim()))
                        .filter(pay -> pay.getOrder().getId().equals(order.getId()));
                if (named.isPresent()) {
                    return named.get();
                }
            } catch (IllegalArgumentException ignored) {
                // not one of our ids: fall through
            }
        }
        return payments.findFirstByOrderIdOrderByCreatedAtDesc(order.getId())
                .orElseGet(() -> payments.save(Payment.started(order, PROVIDER)));
    }

    /** Orders with a payment that is still in progress at PayHere are not timed out. */
    public boolean hasPaymentInProgress(UUID orderId) {
        return payments.existsByOrderIdAndStatusIn(orderId, EnumSet.of(Payment.Status.PENDING, Payment.Status.SUCCEEDED));
    }

    static String[] splitName(String fullName) {
        String name = fullName.trim();
        int space = name.lastIndexOf(' ');
        return space > 0 ? new String[] {name.substring(0, space), name.substring(space + 1)} : new String[] {name, name};
    }

    private static String truncate(String value, int max) {
        return value == null ? null : value.length() <= max ? value : value.substring(0, max);
    }

    /** Order numbers in logs only when they look like ours (no personal data, no log injection). */
    private static String safe(String orderNumber) {
        return orderNumber.matches("SD-\\d{1,10}") ? orderNumber : "(invalid)";
    }
}
