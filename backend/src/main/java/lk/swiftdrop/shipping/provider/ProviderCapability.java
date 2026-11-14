package lk.swiftdrop.shipping.provider;

/**
 * What SwiftDrop can do with a courier. Capabilities are data, so pages and
 * services ask "can I?" instead of checking courier names. API capabilities are
 * added only after they are verified against the courier's official API.
 */
public enum ProviderCapability {
    /** Prices from a rate card typed in by the admin. */
    RATE_CARD,
    /** Live prices from the courier's API (Shipping Phase D, after verification). */
    LIVE_RATES,
    /** The admin books on the courier's own portal, then records the AWB here. */
    MANUAL_BOOKING,
    /** The admin enters tracking updates by hand. */
    MANUAL_TRACKING,
    /** "Track on the courier's website" link (the admin entered the link format). */
    TRACKING_LINK
}
