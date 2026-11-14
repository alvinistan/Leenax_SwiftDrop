package lk.swiftdrop.shipping.provider;

import java.util.Set;
import lk.swiftdrop.shipping.config.CourierProviderConfig;

/**
 * One courier integration. Today every courier is MANUAL (booked on the
 * courier's portal). An API integration (DHL in Shipping Phase D) adds its
 * verified capabilities here, so the rest of the app does not change.
 */
public interface CourierProvider {

    /** Matches courier_providers.code, e.g. "DEX". */
    String code();

    /** What can be done with this courier, given the admin's settings. */
    Set<ProviderCapability> capabilities(CourierProviderConfig config);
}
