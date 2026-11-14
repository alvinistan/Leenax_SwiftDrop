package lk.swiftdrop.shipping.pricing;

/** How the platform fee is calculated from the courier price. */
public enum MarkupType {
    /** A percentage of the courier price, e.g. 2 %. */
    PERCENT,
    /** A fixed amount, e.g. LKR 150. */
    FIXED,
    /** Both: percentage + fixed amount. */
    COMBINED
}
