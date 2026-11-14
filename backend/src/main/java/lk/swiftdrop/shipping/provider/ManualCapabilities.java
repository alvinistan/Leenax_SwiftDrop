package lk.swiftdrop.shipping.provider;

import java.util.EnumSet;
import java.util.Set;
import lk.swiftdrop.shipping.config.CourierProviderConfig;
import lk.swiftdrop.shipping.config.RatesSource;

/** Capabilities every courier has without an API: manual booking and tracking. */
final class ManualCapabilities {

    private ManualCapabilities() {
    }

    static Set<ProviderCapability> of(CourierProviderConfig config) {
        EnumSet<ProviderCapability> capabilities =
                EnumSet.of(ProviderCapability.MANUAL_BOOKING, ProviderCapability.MANUAL_TRACKING);
        if (config.getRatesSource() == RatesSource.RATE_CARD) {
            capabilities.add(ProviderCapability.RATE_CARD);
        }
        if (config.getTrackingUrlTemplate() != null) {
            capabilities.add(ProviderCapability.TRACKING_LINK);
        }
        return capabilities;
    }
}
