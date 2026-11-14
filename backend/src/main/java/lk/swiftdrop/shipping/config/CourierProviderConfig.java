package lk.swiftdrop.shipping.config;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * A courier company's settings (e.g. DHL Express, DEX). Holds NO credentials:
 * API keys live only in environment variables (Shipping Phase D).
 */
@Entity
@Table(name = "courier_providers")
public class CourierProviderConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 30, updatable = false)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private boolean enabled;

    @Enumerated(EnumType.STRING)
    @Column(name = "rates_source", nullable = false, length = 10)
    private RatesSource ratesSource;

    /** cm³ per kg; null = this courier charges actual weight only. */
    @Column(name = "volumetric_divisor")
    private Integer volumetricDivisor;

    @Column(name = "weight_rounding_increment_kg", nullable = false, precision = 6, scale = 3)
    private BigDecimal weightRoundingIncrementKg;

    /** False until the owner confirms the divisor and rounding from the contract. */
    @Column(name = "rules_verified", nullable = false)
    private boolean rulesVerified;

    @Column(length = 500)
    private String notes;

    @OneToMany(mappedBy = "provider", cascade = CascadeType.ALL)
    @OrderBy("code ASC")
    private List<CourierServiceConfig> services = new ArrayList<>();

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CourierProviderConfig() {
    }

    public void update(boolean enabled, RatesSource ratesSource, Integer volumetricDivisor,
                       BigDecimal weightRoundingIncrementKg, boolean rulesVerified, String notes) {
        this.enabled = enabled;
        this.ratesSource = ratesSource;
        this.volumetricDivisor = volumetricDivisor;
        this.weightRoundingIncrementKg = weightRoundingIncrementKg;
        this.rulesVerified = rulesVerified;
        this.notes = notes;
    }

    public UUID getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public RatesSource getRatesSource() {
        return ratesSource;
    }

    public Integer getVolumetricDivisor() {
        return volumetricDivisor;
    }

    public BigDecimal getWeightRoundingIncrementKg() {
        return weightRoundingIncrementKg;
    }

    public boolean isRulesVerified() {
        return rulesVerified;
    }

    public String getNotes() {
        return notes;
    }

    public List<CourierServiceConfig> getServices() {
        return Collections.unmodifiableList(services);
    }
}
