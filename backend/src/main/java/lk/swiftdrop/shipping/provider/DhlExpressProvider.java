package lk.swiftdrop.shipping.provider;

import java.util.Set;
import lk.swiftdrop.shipping.config.CourierProviderConfig;
import org.springframework.stereotype.Component;

/**
 * DHL Express, international. MyDHL API capabilities (LIVE_RATES, booking,
 * labels, tracking) are NOT enabled until they are verified in Shipping
 * Phase D. Until then DHL can be used manually, like DEX.
 */
@Component
public class DhlExpressProvider implements CourierProvider {

    @Override
    public String code() {
        return "DHL_EXPRESS";
    }

    @Override
    public Set<ProviderCapability> capabilities(CourierProviderConfig config) {
        return ManualCapabilities.of(config);
    }
}
