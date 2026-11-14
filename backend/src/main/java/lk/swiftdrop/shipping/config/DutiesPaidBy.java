package lk.swiftdrop.shipping.config;

/** International orders: who pays import duties and taxes at the destination. */
public enum DutiesPaidBy {
    /** The customer pays on delivery (owner decision, 2026-11-14). */
    RECEIVER,
    /** The shop pays (would need to be included in the price). */
    SENDER
}
