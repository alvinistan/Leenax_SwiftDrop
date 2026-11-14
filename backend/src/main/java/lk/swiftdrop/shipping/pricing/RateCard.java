package lk.swiftdrop.shipping.pricing;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lk.swiftdrop.shipping.config.CourierServiceConfig;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * A courier's prices for one service and one destination country, entered by
 * the admin from the courier's price list. Weight bands are in ascending order.
 */
@Entity
@Table(name = "courier_rate_cards")
public class RateCard {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_id", nullable = false)
    private CourierServiceConfig service;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "country_code", nullable = false, length = 2)
    private String countryCode;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(nullable = false, length = 3)
    private String currency = "LKR";

    @Column(nullable = false)
    private boolean enabled;

    @ElementCollection
    @CollectionTable(name = "courier_rate_card_bands", joinColumns = @JoinColumn(name = "rate_card_id"))
    @OrderColumn(name = "position")
    private List<RateBand> bands = new ArrayList<>();

    @Version
    private long version;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected RateCard() {
    }

    public RateCard(CourierServiceConfig service) {
        this.service = service;
    }

    public void update(CourierServiceConfig service, String countryCode, boolean enabled, List<RateBand> bands) {
        this.service = service;
        this.countryCode = countryCode;
        this.enabled = enabled;
        this.bands.clear();
        this.bands.addAll(bands);
    }

    /** The price of the first band that covers the chargeable weight; empty if it's heavier than every band. */
    public Optional<BigDecimal> priceFor(BigDecimal chargeableWeightKg) {
        return bands.stream()
                .filter(band -> chargeableWeightKg.compareTo(band.maxWeightKg()) <= 0)
                .findFirst()
                .map(RateBand::price);
    }

    public UUID getId() {
        return id;
    }

    public CourierServiceConfig getService() {
        return service;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public String getCurrency() {
        return currency;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public List<RateBand> getBands() {
        return List.copyOf(bands);
    }
}
