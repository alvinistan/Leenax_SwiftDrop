package lk.swiftdrop.shipping.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lk.swiftdrop.catalog.product.ShippingCategory;
import lk.swiftdrop.shipping.provider.ProviderCapability;

/** Request and response shapes for shipping configuration (admin API). */
public final class ShippingConfigDtos {

    private ShippingConfigDtos() {
    }

    // ---- settings ----

    public record SettingsRequest(
            @NotBlank(message = "Address line 1 is required.") @Size(max = 150) String originLine1,
            @Size(max = 150) String originLine2,
            @NotBlank(message = "City is required.") @Size(max = 100) String originCity,
            @Size(max = 20) String originPostalCode,
            @NotNull @Pattern(regexp = "^[A-Z]{2}$", message = "Use a two-letter country code, e.g. LK.") String originCountry,
            @NotNull(message = "Default packaging weight is required.")
            @DecimalMin(value = "0", message = "Packaging weight cannot be negative.")
            @Digits(integer = 7, fraction = 3, message = "At most 3 decimal places.") BigDecimal defaultPackagingKg,
            @NotNull DutiesPaidBy dutiesPaidBy) {
    }

    public record SettingsResponse(String originLine1, String originLine2, String originCity, String originPostalCode,
                                   String originCountry, BigDecimal defaultPackagingKg, DutiesPaidBy dutiesPaidBy) {

        static SettingsResponse from(ShippingSettings s) {
            return new SettingsResponse(s.getOriginLine1(), s.getOriginLine2(), s.getOriginCity(),
                    s.getOriginPostalCode(), s.getOriginCountry(), s.getDefaultPackagingKg(), s.getDutiesPaidBy());
        }
    }

    // ---- couriers ----

    public record ServiceToggle(@NotNull UUID id, @NotNull Boolean enabled) {
    }

    public record ProviderUpdateRequest(
            @NotNull Boolean enabled,
            @NotNull RatesSource ratesSource,
            @Positive(message = "The divisor must be more than 0 (or empty).") Integer volumetricDivisor,
            @NotNull(message = "Weight rounding is required.")
            @DecimalMin(value = "0.001", message = "Rounding must be more than 0.")
            @Digits(integer = 3, fraction = 3) BigDecimal weightRoundingIncrementKg,
            @NotNull Boolean rulesVerified,
            @Size(max = 500) String notes,
            @Size(max = 20) List<@Valid ServiceToggle> services,
            /** From the courier's official website, with {awb} where the tracking number goes. */
            @Size(max = 300)
            @Pattern(regexp = "^https://[^\\s]*\\{awb\\}[^\\s]*$",
                    message = "Use a secure link (https://) that contains {awb}, e.g. https://courier.example/track?awb={awb}.")
            String trackingUrlTemplate) {
    }

    public record ServiceResponse(UUID id, String code, String name, ServiceScope scope, boolean enabled) {

        static ServiceResponse from(CourierServiceConfig s) {
            return new ServiceResponse(s.getId(), s.getCode(), s.getName(), s.getScope(), s.isEnabled());
        }
    }

    public record ProviderResponse(UUID id, String code, String name, boolean enabled, RatesSource ratesSource,
                                   Integer volumetricDivisor, BigDecimal weightRoundingIncrementKg,
                                   boolean rulesVerified, String notes, List<ServiceResponse> services,
                                   String trackingUrlTemplate, Set<ProviderCapability> capabilities) {

        static ProviderResponse from(CourierProviderConfig p, Set<ProviderCapability> capabilities) {
            return new ProviderResponse(p.getId(), p.getCode(), p.getName(), p.isEnabled(), p.getRatesSource(),
                    p.getVolumetricDivisor(), p.getWeightRoundingIncrementKg(), p.isRulesVerified(), p.getNotes(),
                    p.getServices().stream().map(ServiceResponse::from).toList(), p.getTrackingUrlTemplate(),
                    new java.util.TreeSet<>(capabilities));
        }
    }

    // ---- boxes ----

    public record PresetRequest(
            @NotBlank(message = "Name is required.") @Size(max = 60) String name,
            @NotNull @DecimalMin(value = "0.1", message = "Length must be more than 0.") @Digits(integer = 7, fraction = 1) BigDecimal lengthCm,
            @NotNull @DecimalMin(value = "0.1", message = "Width must be more than 0.") @Digits(integer = 7, fraction = 1) BigDecimal widthCm,
            @NotNull @DecimalMin(value = "0.1", message = "Height must be more than 0.") @Digits(integer = 7, fraction = 1) BigDecimal heightCm,
            @NotNull @DecimalMin(value = "0", message = "Weight cannot be negative.") @Digits(integer = 7, fraction = 3) BigDecimal emptyWeightKg,
            @DecimalMin(value = "0.001", message = "Maximum weight must be more than 0.") @Digits(integer = 7, fraction = 3) BigDecimal maxWeightKg,
            @NotNull Boolean enabled) {
    }

    public record PresetResponse(UUID id, String name, BigDecimal lengthCm, BigDecimal widthCm, BigDecimal heightCm,
                                 BigDecimal emptyWeightKg, BigDecimal maxWeightKg, boolean enabled) {

        static PresetResponse from(PackagePreset p) {
            return new PresetResponse(p.getId(), p.getName(), p.getLengthCm(), p.getWidthCm(), p.getHeightCm(),
                    p.getEmptyWeightKg(), p.getMaxWeightKg(), p.isEnabled());
        }
    }

    // ---- country restrictions ----

    public record CategoryPolicyRequest(
            @NotNull Boolean internationalAllowed,
            @NotNull @Size(max = 300) List<@Pattern(regexp = "^[A-Z]{2}$", message = "Use two-letter country codes.") String> blockedCountries) {
    }

    public record CategoryPolicyResponse(ShippingCategory category, boolean internationalAllowed, List<String> blockedCountries) {

        static CategoryPolicyResponse from(ShippingCategoryPolicy p) {
            return new CategoryPolicyResponse(p.getCategory(), p.isInternationalAllowed(), List.copyOf(p.getBlockedCountries()));
        }
    }

    /** A product that has its own restrictions on top of its category's. */
    public record ProductRestrictionResponse(UUID productId, String productName, ShippingCategory category,
                                             boolean domesticOnly, List<String> blockedCountries) {
    }
}
