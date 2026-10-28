package lk.swiftdrop.store;

import java.util.UUID;

/**
 * Values for the single-seller store. When more sellers are supported
 * (Phase 15), the seller will come from the logged-in user instead.
 */
public final class StoreDefaults {

    /** The seller row created by V1__create_sellers.sql. */
    public static final UUID DEFAULT_SELLER_ID =
            UUID.fromString("00000000-0000-0000-0000-000000000001");

    /** The store's transaction currency (ISO 4217). */
    public static final String DEFAULT_CURRENCY = "LKR";

    private StoreDefaults() {
    }
}
