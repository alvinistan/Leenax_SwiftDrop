package lk.swiftdrop.shipping.provider;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lk.swiftdrop.shipping.config.CourierProviderConfig;
import org.springframework.stereotype.Component;

/** Finds the integration for a courier. A courier without one is handled manually. */
@Component
public class CourierProviderRegistry {

    private final Map<String, CourierProvider> byCode;

    public CourierProviderRegistry(List<CourierProvider> providers) {
        this.byCode = providers.stream().collect(Collectors.toMap(CourierProvider::code, Function.identity()));
    }

    public Set<ProviderCapability> capabilities(CourierProviderConfig config) {
        CourierProvider provider = byCode.get(config.getCode());
        return provider != null ? provider.capabilities(config) : ManualCapabilities.of(config);
    }
}
