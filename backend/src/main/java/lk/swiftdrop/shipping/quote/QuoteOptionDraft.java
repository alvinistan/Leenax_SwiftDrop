package lk.swiftdrop.shipping.quote;

import java.math.BigDecimal;
import java.util.UUID;

/** A calculated delivery option, before (or without) being saved. */
public record QuoteOptionDraft(
        UUID serviceId,
        String providerCode,
        String providerName,
        String serviceName,
        BigDecimal volumetricWeightKg,
        BigDecimal chargeableWeightKg,
        BigDecimal courierPrice,
        BigDecimal platformFee,
        BigDecimal customerPrice,
        String currency,
        UUID markupRuleId,
        String markupDescription) {
}
