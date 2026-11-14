package lk.swiftdrop.shipping.provider;

import java.util.Set;
import lk.swiftdrop.shipping.config.CourierProviderConfig;
import org.springframework.stereotype.Component;

/**
 * DEX, domestic. No DEX API is known or assumed (no documents or partner
 * agreement yet), so DEX is MANUAL: rate card, booking on the DEX portal,
 * tracking updates entered by the admin.
 */
@Component
public class DexManualProvider implements CourierProvider {

    @Override
    public String code() {
        return "DEX";
    }

    @Override
    public Set<ProviderCapability> capabilities(CourierProviderConfig config) {
        return ManualCapabilities.of(config);
    }
}
