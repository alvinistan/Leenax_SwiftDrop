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

    /** Postal codes this service covers; empty = everywhere in its scope (Phase 10, own delivery). */
    @jakarta.persistence.ElementCollection(fetch = FetchType.EAGER)
    @jakarta.persistence.CollectionTable(name = "courier_service_postal_codes",
            joinColumns = @JoinColumn(name = "service_id"))
    @Column(name = "postal_code", nullable = false, length = 10)
    private java.util.Set<String> postalCodes = new java.util.TreeSet<>();

    protected CourierServiceConfig() {
    }

    /** "40000", " 40000 " and "40 000" are the same code. */
    public static String normalizePostalCode(String code) {
        return code == null ? null : code.replaceAll("\\s", "").toUpperCase(java.util.Locale.ROOT);
    }

    public boolean hasServiceArea() {
        return !postalCodes.isEmpty();
    }

    /** Is this postal code inside the service area? Always true when no area is set. */
    public boolean covers(String postalCode) {
        if (postalCodes.isEmpty()) {
            return true;
        }
        String normalized = normalizePostalCode(postalCode);
        return normalized != null && postalCodes.contains(normalized);
    }

    public void setPostalCodes(java.util.Collection<String> codes) {
        postalCodes.clear();
        codes.stream().map(CourierServiceConfig::normalizePostalCode).filter(c -> !c.isEmpty())
                .forEach(postalCodes::add);
    }

    public java.util.Set<String> getPostalCodes() {
        return java.util.Collections.unmodifiableSet(new java.util.TreeSet<>(postalCodes));
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
