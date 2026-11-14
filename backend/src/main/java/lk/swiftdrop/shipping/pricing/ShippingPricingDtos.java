package lk.swiftdrop.shipping.pricing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.shipping.config.ServiceScope;

/** Request and response shapes for platform-fee rules and courier rate cards (admin API). */
public final class ShippingPricingDtos {

    private ShippingPricingDtos() {
    }

    // ---- platform-fee (markup) rules ----

    public record MarkupRuleRequest(
            @NotBlank(message = "Name is required.") @Size(max = 100) String name,
            @NotNull(message = "Choose a fee type.") MarkupType type,
            @DecimalMin(value = "0", message = "Percent cannot be negative.")
            @DecimalMax(value = "100", message = "Percent cannot be more than 100.")
            @Digits(integer = 3, fraction = 2, message = "At most 2 decimal places.") BigDecimal percent,
            @DecimalMin(value = "0", message = "Amount cannot be negative.")
            @Digits(integer = 13, fraction = 2, message = "At most 2 decimal places.") BigDecimal fixedAmount,
            @DecimalMin(value = "0", message = "Minimum cannot be negative.")
            @Digits(integer = 13, fraction = 2, message = "At most 2 decimal places.") BigDecimal minFee,
            @DecimalMin(value = "0", message = "Maximum cannot be negative.")
            @Digits(integer = 13, fraction = 2, message = "At most 2 decimal places.") BigDecimal maxFee,
            UUID providerId,
            @Pattern(regexp = "^[A-Z]{2}$", message = "Use a two-letter country code.") String countryCode,
            Instant effectiveFrom,
            Instant effectiveTo,
            @NotNull Boolean enabled,
            @Min(0) @Max(1000) int priority) {
    }

    public record MarkupRuleResponse(UUID id, String name, MarkupType type, BigDecimal percent, BigDecimal fixedAmount,
                                     BigDecimal minFee, BigDecimal maxFee, UUID providerId, String countryCode,
                                     Instant effectiveFrom, Instant effectiveTo, boolean enabled, int priority,
                                     boolean activeNow, String description) {

        static MarkupRuleResponse from(MarkupRule r, Instant now) {
            return new MarkupRuleResponse(r.getId(), r.getName(), r.getType(), r.getPercent(), r.getFixedAmount(),
                    r.getMinFee(), r.getMaxFee(), r.getProviderId(), r.getCountryCode(), r.getEffectiveFrom(),
                    r.getEffectiveTo(), r.isEnabled(), r.getPriority(), r.isActiveAt(now),
                    MarkupCalculator.describe(r.getName(), r.toMarkup()));
        }
    }

    // ---- rate cards ----

    public record RateBandDto(
            @NotNull(message = "Weight is required.")
            @DecimalMin(value = "0.001", message = "Weight must be more than 0.")
            @Digits(integer = 7, fraction = 3, message = "At most 3 decimal places.") BigDecimal maxWeightKg,
            @NotNull(message = "Price is required.")
            @DecimalMin(value = "0", message = "Price cannot be negative.")
            @Digits(integer = 13, fraction = 2, message = "At most 2 decimal places.") BigDecimal price) {
    }

    public record RateCardRequest(
            @NotNull(message = "Choose a courier service.") UUID serviceId,
            @NotNull @Pattern(regexp = "^[A-Z]{2}$", message = "Use a two-letter country code.") String countryCode,
            @NotNull Boolean enabled,
            @NotEmpty(message = "Add at least one weight band.") @Size(max = 100) List<@Valid @NotNull RateBandDto> bands) {
    }

    public record RateCardResponse(UUID id, UUID serviceId, String providerCode, String providerName,
                                   String serviceName, ServiceScope scope, String countryCode, String currency,
                                   boolean enabled, List<RateBandDto> bands) {

        static RateCardResponse from(RateCard c) {
            var s = c.getService();
            return new RateCardResponse(c.getId(), s.getId(), s.getProvider().getCode(), s.getProvider().getName(),
                    s.getName(), s.getScope(), c.getCountryCode(), c.getCurrency(), c.isEnabled(),
                    c.getBands().stream().map(b -> new RateBandDto(b.maxWeightKg(), b.price())).toList());
        }
    }
}
