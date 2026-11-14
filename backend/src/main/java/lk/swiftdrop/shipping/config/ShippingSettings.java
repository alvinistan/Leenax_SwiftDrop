package lk.swiftdrop.shipping.config;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/** The store's shipping settings. There is exactly one row (id = 1). */
@Entity
@Table(name = "shipping_settings")
public class ShippingSettings {

    public static final short ID = 1;

    @Id
    private short id;

    @Column(name = "origin_line1", nullable = false, length = 150)
    private String originLine1;

    @Column(name = "origin_line2", length = 150)
    private String originLine2;

    @Column(name = "origin_city", nullable = false, length = 100)
    private String originCity;

    @Column(name = "origin_postal_code", length = 20)
    private String originPostalCode;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "origin_country", nullable = false, length = 2)
    private String originCountry;

    @Column(name = "default_packaging_kg", nullable = false, precision = 10, scale = 3)
    private BigDecimal defaultPackagingKg;

    @Enumerated(EnumType.STRING)
    @Column(name = "duties_paid_by", nullable = false, length = 10)
    private DutiesPaidBy dutiesPaidBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ShippingSettings() {
    }

    public void update(String line1, String line2, String city, String postalCode, String country,
                       BigDecimal defaultPackagingKg, DutiesPaidBy dutiesPaidBy) {
        this.originLine1 = line1;
        this.originLine2 = line2;
        this.originCity = city;
        this.originPostalCode = postalCode;
        this.originCountry = country;
        this.defaultPackagingKg = defaultPackagingKg;
        this.dutiesPaidBy = dutiesPaidBy;
    }

    public String getOriginLine1() {
        return originLine1;
    }

    public String getOriginLine2() {
        return originLine2;
    }

    public String getOriginCity() {
        return originCity;
    }

    public String getOriginPostalCode() {
        return originPostalCode;
    }

    public String getOriginCountry() {
        return originCountry;
    }

    public BigDecimal getDefaultPackagingKg() {
        return defaultPackagingKg;
    }

    public DutiesPaidBy getDutiesPaidBy() {
        return dutiesPaidBy;
    }
}
