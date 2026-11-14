package lk.swiftdrop.shipping.config;

/** Where a courier's prices come from. */
public enum RatesSource {
    /** Live from the courier's API (needs an integration: Shipping Phase D). */
    API,
    /** From rate cards the admin enters from the courier's price list. */
    RATE_CARD
}
