package lk.swiftdrop.order;

/**
 * How the customer pays (owner decision D-5, 2026-11-14). Online card payment
 * comes in master Phase 9.
 */
public enum PaymentMethod {
    /** Cash on delivery: Sri Lanka only, and only if every product allows it. */
    COD,
    /** The owner contacts the customer to arrange payment. */
    ARRANGE_LATER
}
