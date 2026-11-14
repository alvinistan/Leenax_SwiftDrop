package lk.swiftdrop.shipping.config;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

/** A country we deliver to (owner decision D-3). The origin country is always included. */
@Entity
@Table(name = "shipping_destinations")
public class ShippingDestination {

    @Id
    @Column(name = "country_code", length = 2)
    private String countryCode;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ShippingDestination() {
    }

    public ShippingDestination(String countryCode) {
        this.countryCode = countryCode;
    }

    public String getCountryCode() {
        return countryCode;
    }
}
