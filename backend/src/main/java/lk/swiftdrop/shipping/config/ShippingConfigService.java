package lk.swiftdrop.shipping.config;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lk.swiftdrop.catalog.product.ProductRepository;
import lk.swiftdrop.catalog.product.ShippingCategory;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.shipping.audit.ShippingAuditService;
import lk.swiftdrop.shipping.provider.CourierProviderRegistry;
import lk.swiftdrop.shipping.audit.ShippingAuditService.Action;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.CategoryPolicyRequest;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.CategoryPolicyResponse;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.PresetRequest;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.PresetResponse;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.ProductRestrictionResponse;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.ProviderResponse;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.ProviderUpdateRequest;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.ServiceToggle;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.SettingsRequest;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.SettingsResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Shipping settings, couriers, box sizes and country restrictions. Every change is audited. */
@Service
@Transactional(readOnly = true)
public class ShippingConfigService {

    private final ShippingSettingsRepository settings;
    private final CourierProviderRepository providers;
    private final PackagePresetRepository presets;
    private final ShippingCategoryPolicyRepository policies;
    private final ShippingAuditService audit;
    private final ProductRepository products;
    private final CourierProviderRegistry registry;

    public ShippingConfigService(ShippingSettingsRepository settings, CourierProviderRepository providers,
                                 PackagePresetRepository presets, ShippingCategoryPolicyRepository policies,
                                 ShippingAuditService audit, ProductRepository products,
                                 CourierProviderRegistry registry) {
        this.products = products;
        this.registry = registry;
        this.settings = settings;
        this.providers = providers;
        this.presets = presets;
        this.policies = policies;
        this.audit = audit;
    }

    // ---- settings ----

    public ShippingSettings currentSettings() {
        return settings.findById(ShippingSettings.ID)
                .orElseThrow(() -> new IllegalStateException("shipping_settings row missing (Flyway V9)"));
    }

    public SettingsResponse getSettings() {
        return SettingsResponse.from(currentSettings());
    }

    @Transactional
    public SettingsResponse updateSettings(SettingsRequest r) {
        requireCountry(r.originCountry());
        ShippingSettings s = currentSettings();
        SettingsResponse before = SettingsResponse.from(s);
        s.update(r.originLine1().trim(), blankToNull(r.originLine2()), r.originCity().trim(),
                blankToNull(r.originPostalCode()), r.originCountry(), r.defaultPackagingKg(), r.dutiesPaidBy());
        SettingsResponse after = SettingsResponse.from(s);
        audit.record("SETTINGS", ShippingSettings.ID, Action.UPDATE, before, after);
        return after;
    }

    // ---- couriers ----

    public List<ProviderResponse> listProviders() {
        return providers.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public ProviderResponse updateProvider(UUID id, ProviderUpdateRequest r) {
        CourierProviderConfig provider = providers.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Courier", id));
        ProviderResponse before = toResponse(provider);
        provider.update(r.enabled(), r.ratesSource(), r.volumetricDivisor(), r.weightRoundingIncrementKg(),
                r.rulesVerified(), blankToNull(r.notes()), blankToNull(r.trackingUrlTemplate()));

        // Only this courier's services can be changed through this courier (IDOR protection).
        Map<UUID, CourierServiceConfig> own = provider.getServices().stream()
                .collect(Collectors.toMap(CourierServiceConfig::getId, Function.identity()));
        for (ServiceToggle toggle : Objects.requireNonNullElse(r.services(), List.<ServiceToggle>of())) {
            CourierServiceConfig service = own.get(toggle.id());
            if (service == null) {
                throw new ResourceNotFoundException("Courier service", toggle.id());
            }
            service.setEnabled(toggle.enabled());
        }
        ProviderResponse after = toResponse(provider);
        audit.record("COURIER", provider.getCode(), Action.UPDATE, before, after);
        return after;
    }

    private ProviderResponse toResponse(CourierProviderConfig provider) {
        return ProviderResponse.from(provider, registry.capabilities(provider));
    }

    // ---- boxes ----

    public List<PresetResponse> listPresets() {
        return presets.findAllByOrderByNameAsc().stream().map(PresetResponse::from).toList();
    }

    @Transactional
    public PresetResponse createPreset(PresetRequest r) {
        if (presets.existsByName(r.name().trim())) {
            throw new ConflictException("A box named '" + r.name().trim() + "' already exists.");
        }
        PackagePreset preset = presets.save(new PackagePreset(r.name().trim(), r.lengthCm(), r.widthCm(), r.heightCm(),
                r.emptyWeightKg(), r.maxWeightKg(), r.enabled()));
        PresetResponse after = PresetResponse.from(preset);
        audit.record("BOX", preset.getId(), Action.CREATE, null, after);
        return after;
    }

    @Transactional
    public PresetResponse updatePreset(UUID id, PresetRequest r) {
        PackagePreset preset = presets.findById(id).orElseThrow(() -> new ResourceNotFoundException("Box", id));
        if (presets.existsByNameAndIdNot(r.name().trim(), id)) {
            throw new ConflictException("A box named '" + r.name().trim() + "' already exists.");
        }
        PresetResponse before = PresetResponse.from(preset);
        preset.update(r.name().trim(), r.lengthCm(), r.widthCm(), r.heightCm(), r.emptyWeightKg(), r.maxWeightKg(), r.enabled());
        PresetResponse after = PresetResponse.from(preset);
        audit.record("BOX", id, Action.UPDATE, before, after);
        return after;
    }

    @Transactional
    public void deletePreset(UUID id) {
        PackagePreset preset = presets.findById(id).orElseThrow(() -> new ResourceNotFoundException("Box", id));
        audit.record("BOX", id, Action.DELETE, PresetResponse.from(preset), null);
        presets.delete(preset);
    }

    // ---- country restrictions ----

    public List<CategoryPolicyResponse> listCategoryPolicies() {
        return policies.findAll().stream()
                .sorted(Comparator.comparing(ShippingCategoryPolicy::getCategory))
                .map(CategoryPolicyResponse::from)
                .toList();
    }

    @Transactional
    public CategoryPolicyResponse updateCategoryPolicy(ShippingCategory category, CategoryPolicyRequest r) {
        ShippingCategoryPolicy policy = policies.findById(category)
                .orElseThrow(() -> new ResourceNotFoundException("Shipping category", category));
        r.blockedCountries().forEach(ShippingConfigService::requireCountry);
        CategoryPolicyResponse before = CategoryPolicyResponse.from(policy);
        policy.update(r.internationalAllowed(), r.blockedCountries());
        CategoryPolicyResponse after = CategoryPolicyResponse.from(policy);
        audit.record("COUNTRY_RESTRICTIONS", category, Action.UPDATE, before, after);
        return after;
    }

    /** Products whose own rules restrict them further (edited in the product form). */
    public List<ProductRestrictionResponse> listProductRestrictions() {
        return products.findWithOwnShippingRestrictions().stream()
                .map(p -> new ProductRestrictionResponse(p.getId(), p.getName(), p.getShippingCategory(),
                        p.isShippingDomesticOnly(), p.getShippingBlockedCountries()))
                .toList();
    }

    static void requireCountry(String code) {
        if (!Countries.isValid(code)) {
            throw new BadRequestException("Unknown country code: " + code);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
