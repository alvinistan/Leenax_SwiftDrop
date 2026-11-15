package lk.swiftdrop.shipping.provider;

import java.util.Set;
import lk.swiftdrop.shipping.config.CourierProviderConfig;
import org.springframework.stereotype.Component;

/**
 * The store's own delivery staff (owner decision D-7). Parcels get a SwiftDrop
 * reference (LD-000001) instead of a courier AWB and are assigned to a staff
 * member, who updates them from the delivery pages.
 */
@Component
public class OwnDeliveryProvider implements CourierProvider {

    public static final String CODE = "OWN_DELIVERY";

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public Set<ProviderCapability> capabilities(CourierProviderConfig config) {
        Set<ProviderCapability> capabilities = ManualCapabilities.of(config);
        capabilities.remove(ProviderCapability.TRACKING_LINK); // no courier website
        capabilities.add(ProviderCapability.STAFF_DELIVERY);
        return capabilities;
    }
}
