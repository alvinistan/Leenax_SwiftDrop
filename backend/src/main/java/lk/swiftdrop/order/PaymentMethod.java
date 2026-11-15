package lk.swiftdrop.order;

/**
 * How the customer pays (owner decision D-5, 2026-11-14). Online card payment
 * is CARD (PayHere, master Phase 9).
 */
public enum PaymentMethod {
    /** Cash on delivery: Sri Lanka only, and only if every product allows it. */
    COD,
    /** The owner contacts the customer to arrange payment. */
    ARRANGE_LATER,
    /** Online card payment through PayHere (master Phase 9). Paid only after a verified notification. */
    CARD
}
