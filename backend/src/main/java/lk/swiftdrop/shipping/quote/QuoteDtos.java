package lk.swiftdrop.shipping.quote;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.common.money.MoneyResponse;
import lk.swiftdrop.shipping.config.DutiesPaidBy;
import lk.swiftdrop.shipping.config.ServiceScope;

/**
 * Shipping quote shapes. The request has NO prices: the browser says only
 * what and where; every price is worked out on the server.
 */
public final class QuoteDtos {

    private QuoteDtos() {
    }

    public record QuoteItemRequest(
            @NotNull(message = "Choose a product option.") UUID variantId,
            @NotNull(message = "Quantity is required.")
            @DecimalMin(value = "0.001", message = "Quantity must be more than 0.")
            @Digits(integer = 7, fraction = 3, message = "At most 3 decimal places.") BigDecimal quantity) {
    }

    public record QuoteRequest(
            @NotNull(message = "Choose a country.")
            @Pattern(regexp = "^[A-Z]{2}$", message = "Use a two-letter country code, e.g. LK.") String countryCode,
            @Size(max = 20) String postalCode,
            @NotEmpty(message = "Add at least one item.")
            @Size(max = 50, message = "At most 50 items per quote.") List<@Valid @NotNull QuoteItemRequest> items) {
    }

    // ---- full breakdown (admin) ----

    public record ItemLine(UUID variantId, String productName, String sku, String shippingCategory,
                           BigDecimal quantity, BigDecimal unitWeightKg, String problem) {
    }

    public record ParcelView(BigDecimal itemsWeightKg, BigDecimal packagingKg, BigDecimal actualWeightKg,
                             String boxName, BigDecimal lengthCm, BigDecimal widthCm, BigDecimal heightCm,
                             boolean fits) {
    }

    public record OptionBreakdown(UUID serviceId, String providerCode, String providerName, String serviceName,
                                  ServiceScope scope, boolean available, String unavailableReason,
                                  BigDecimal volumetricWeightKg, BigDecimal chargeableWeightKg,
                                  MoneyResponse courierPrice, MoneyResponse platformFee, MoneyResponse customerPrice,
                                  UUID markupRuleId, String markupDescription) {
    }

    public record AdminQuoteResponse(String destinationCountry, boolean domestic, DutiesPaidBy dutiesPaidBy,
                                     List<ItemLine> items, ParcelView parcel, List<String> problems,
                                     List<String> warnings, List<OptionBreakdown> options) {
    }

    // ---- customer view (no courier cost, no fee) ----

    public record PublicOption(UUID optionId, String providerName, String serviceName, MoneyResponse price) {
    }

    public record PublicQuoteResponse(UUID quoteId, String destinationCountry, boolean domestic,
                                      BigDecimal parcelWeightKg, DutiesPaidBy dutiesPaidBy,
                                      List<PublicOption> options, List<String> problems, Instant expiresAt,
                                      boolean expired) {
    }
}
