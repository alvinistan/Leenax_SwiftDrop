package lk.swiftdrop.shipping.config;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

/** One service a courier offers, e.g. "DEX standard delivery (Sri Lanka)". */
@Entity
@Table(name = "courier_services")
public class CourierServiceConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false)
    private CourierProviderConfig provider;

    @Column(nullable = false, length = 40, updatable = false)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15, updatable = false)
    private ServiceScope scope;

    @Column(nullable = false)
    private boolean enabled;

    protected CourierServiceConfig() {
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public UUID getId() {
        return id;
    }

    public CourierProviderConfig getProvider() {
        return provider;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public ServiceScope getScope() {
        return scope;
    }

    public boolean isEnabled() {
        return enabled;
    }
}
