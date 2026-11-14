package lk.swiftdrop.shipping.quote;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One delivery choice in a saved quote, with the courier price, the platform
 * fee and the customer price kept SEPARATELY (needed for margin reports).
 */
@Entity
@Table(name = "shipping_quote_options")
public class ShippingQuoteOption {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "quote_id", nullable = false)
    private ShippingQuote quote;

    @Column(name = "service_id", nullable = false, updatable = false)
    private UUID serviceId;

    @Column(name = "provider_code", nullable = false, length = 30, updatable = false)
    private String providerCode;

    @Column(name = "provider_name", nullable = false, length = 100, updatable = false)
    private String providerName;

    @Column(name = "service_name", nullable = false, length = 100, updatable = false)
    private String serviceName;

    @Column(name = "volumetric_weight_kg", precision = 12, scale = 3, updatable = false)
    private BigDecimal volumetricWeightKg;

    @Column(name = "chargeable_weight_kg", nullable = false, precision = 12, scale = 3, updatable = false)
    private BigDecimal chargeableWeightKg;

    @Column(name = "courier_price", nullable = false, precision = 19, scale = 4, updatable = false)
    private BigDecimal courierPrice;

    @Column(name = "platform_fee", nullable = false, precision = 19, scale = 4, updatable = false)
    private BigDecimal platformFee;

    @Column(name = "customer_price", nullable = false, precision = 19, scale = 4, updatable = false)
    private BigDecimal customerPrice;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(nullable = false, length = 3, updatable = false)
    private String currency;

    @Column(name = "markup_rule_id", updatable = false)
    private UUID markupRuleId;

    @Column(name = "markup_description", nullable = false, length = 200, updatable = false)
    private String markupDescription;

    @Column(nullable = false, updatable = false)
    private int position;

    protected ShippingQuoteOption() {
    }

    ShippingQuoteOption(ShippingQuote quote, QuoteOptionDraft draft, int position) {
        this.quote = quote;
        this.serviceId = draft.serviceId();
        this.providerCode = draft.providerCode();
        this.providerName = draft.providerName();
        this.serviceName = draft.serviceName();
        this.volumetricWeightKg = draft.volumetricWeightKg();
        this.chargeableWeightKg = draft.chargeableWeightKg();
        this.courierPrice = draft.courierPrice();
        this.platformFee = draft.platformFee();
        this.customerPrice = draft.customerPrice();
        this.currency = draft.currency();
        this.markupRuleId = draft.markupRuleId();
        this.markupDescription = draft.markupDescription();
        this.position = position;
    }

    public UUID getId() {
        return id;
    }

    public ShippingQuote getQuote() {
        return quote;
    }

    public UUID getServiceId() {
        return serviceId;
    }

    public String getProviderCode() {
        return providerCode;
    }

    public String getProviderName() {
        return providerName;
    }

    public String getServiceName() {
        return serviceName;
    }

    public BigDecimal getVolumetricWeightKg() {
        return volumetricWeightKg;
    }

    public BigDecimal getChargeableWeightKg() {
        return chargeableWeightKg;
    }

    public BigDecimal getCourierPrice() {
        return courierPrice;
    }

    public BigDecimal getPlatformFee() {
        return platformFee;
    }

    public BigDecimal getCustomerPrice() {
        return customerPrice;
    }

    public String getCurrency() {
        return currency;
    }

    public UUID getMarkupRuleId() {
        return markupRuleId;
    }

    public String getMarkupDescription() {
        return markupDescription;
    }

    public int getPosition() {
        return position;
    }
}
