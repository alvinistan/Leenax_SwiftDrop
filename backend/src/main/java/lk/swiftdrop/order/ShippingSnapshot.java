package lk.swiftdrop.order;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * The delivery choice as priced when the order was placed. Kept even if the
 * courier's rates or the platform fee change later.
 */
@Embeddable
public record ShippingSnapshot(
        @Column(name = "shipping_quote_option_id", nullable = false) UUID quoteOptionId,
        @Column(name = "shipping_service_id", nullable = false) UUID serviceId,
        @Column(name = "shipping_provider_code", nullable = false, length = 30) String providerCode,
        @Column(name = "shipping_provider_name", nullable = false, length = 100) String providerName,
        @Column(name = "shipping_service_name", nullable = false, length = 100) String serviceName,
        @Column(name = "shipping_courier_price", nullable = false, precision = 19, scale = 2) BigDecimal courierPrice,
        @Column(name = "shipping_platform_fee", nullable = false, precision = 19, scale = 2) BigDecimal platformFee,
        @Column(name = "shipping_markup_rule_id") UUID markupRuleId,
        @Column(name = "shipping_markup_description", nullable = false, length = 200) String markupDescription,
        @Column(name = "chargeable_weight_kg", nullable = false, precision = 12, scale = 3) BigDecimal chargeableWeightKg) {
}
