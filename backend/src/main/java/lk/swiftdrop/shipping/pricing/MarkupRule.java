package lk.swiftdrop.shipping.pricing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lk.swiftdrop.shipping.pricing.MarkupCalculator.Markup;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * A platform-fee rule. Optional scope: one courier, one destination country,
 * both, or neither (the default rule). See MarkupRuleSelector for which applies.
 */
@Entity
@Table(name = "shipping_markup_rules")
public class MarkupRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private MarkupType type;

    @Column(precision = 5, scale = 2)
    private BigDecimal percent;

    @Column(name = "fixed_amount", precision = 19, scale = 4)
    private BigDecimal fixedAmount;

    @Column(name = "min_fee", precision = 19, scale = 4)
    private BigDecimal minFee;

    @Column(name = "max_fee", precision = 19, scale = 4)
    private BigDecimal maxFee;

    @Column(name = "provider_id")
    private UUID providerId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "country_code", length = 2)
    private String countryCode;

    @Column(name = "effective_from", nullable = false)
    private Instant effectiveFrom;

    @Column(name = "effective_to")
    private Instant effectiveTo;

    @Column(nullable = false)
    private boolean enabled;

    @Column(nullable = false)
    private int priority;

    @Version
    private long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MarkupRule() {
    }

    public MarkupRule(String name) {
        this.name = name;
    }

    @SuppressWarnings("checkstyle:ParameterNumber")
    public void update(String name, MarkupType type, BigDecimal percent, BigDecimal fixedAmount, BigDecimal minFee,
                       BigDecimal maxFee, UUID providerId, String countryCode, Instant effectiveFrom,
                       Instant effectiveTo, boolean enabled, int priority) {
        this.name = name;
        this.type = type;
        // Keep only the values the type uses, so the database check stays meaningful.
        this.percent = type == MarkupType.FIXED ? null : percent;
        this.fixedAmount = type == MarkupType.PERCENT ? null : fixedAmount;
        this.minFee = minFee;
        this.maxFee = maxFee;
        this.providerId = providerId;
        this.countryCode = countryCode;
        this.effectiveFrom = effectiveFrom;
        this.effectiveTo = effectiveTo;
        this.enabled = enabled;
        this.priority = priority;
    }

    public Markup toMarkup() {
        return new Markup(type, percent, fixedAmount, minFee, maxFee);
    }

    /** Enabled, and `now` is inside [effectiveFrom, effectiveTo). */
    public boolean isActiveAt(Instant now) {
        return enabled && !now.isBefore(effectiveFrom) && (effectiveTo == null || now.isBefore(effectiveTo));
    }

    /** 3 = courier + country, 2 = courier, 1 = country, 0 = default. */
    int specificity() {
        return (providerId != null ? 2 : 0) + (countryCode != null ? 1 : 0);
    }

    /** Does this rule's scope cover the given courier and destination? */
    boolean covers(UUID provider, String country) {
        return (providerId == null || providerId.equals(provider)) && (countryCode == null || countryCode.equals(country));
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public MarkupType getType() {
        return type;
    }

    public BigDecimal getPercent() {
        return percent;
    }

    public BigDecimal getFixedAmount() {
        return fixedAmount;
    }

    public BigDecimal getMinFee() {
        return minFee;
    }

    public BigDecimal getMaxFee() {
        return maxFee;
    }

    public UUID getProviderId() {
        return providerId;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public Instant getEffectiveFrom() {
        return effectiveFrom;
    }

    public Instant getEffectiveTo() {
        return effectiveTo;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public int getPriority() {
        return priority;
    }
}
