package lk.swiftdrop.shipping.quote;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.shipping.parcel.Parcel;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A saved shipping quote: a SNAPSHOT of the parcel and of every price offered.
 * Never updated. Checkout (master Phase 8) will accept a quote option only
 * while the quote has not expired.
 */
@Entity
@Table(name = "shipping_quotes")
public class ShippingQuote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "destination_country", nullable = false, length = 2, updatable = false)
    private String destinationCountry;

    @Column(name = "destination_postal", length = 20, updatable = false)
    private String destinationPostal;

    @Column(nullable = false, updatable = false)
    private boolean domestic;

    @Column(name = "items_weight_kg", nullable = false, precision = 12, scale = 3, updatable = false)
    private BigDecimal itemsWeightKg;

    @Column(name = "packaging_kg", nullable = false, precision = 10, scale = 3, updatable = false)
    private BigDecimal packagingKg;

    @Column(name = "actual_weight_kg", nullable = false, precision = 12, scale = 3, updatable = false)
    private BigDecimal actualWeightKg;

    @Column(name = "box_name", length = 60, updatable = false)
    private String boxName;

    @Column(name = "length_cm", precision = 8, scale = 1, updatable = false)
    private BigDecimal lengthCm;

    @Column(name = "width_cm", precision = 8, scale = 1, updatable = false)
    private BigDecimal widthCm;

    @Column(name = "height_cm", precision = 8, scale = 1, updatable = false)
    private BigDecimal heightCm;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @OneToMany(mappedBy = "quote", cascade = CascadeType.ALL)
    @OrderBy("position ASC")
    private List<ShippingQuoteOption> options = new ArrayList<>();

    protected ShippingQuote() {
    }

    public ShippingQuote(String destinationCountry, String destinationPostal, boolean domestic, Parcel parcel,
                         Instant createdAt, Instant expiresAt) {
        this.destinationCountry = destinationCountry;
        this.destinationPostal = destinationPostal;
        this.domestic = domestic;
        this.itemsWeightKg = parcel.itemsWeightKg();
        this.packagingKg = parcel.packagingKg();
        this.actualWeightKg = parcel.actualWeightKg();
        this.boxName = parcel.boxName();
        this.lengthCm = parcel.lengthCm();
        this.widthCm = parcel.widthCm();
        this.heightCm = parcel.heightCm();
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    void addOption(ShippingQuoteOption option) {
        options.add(option);
    }

    public UUID getId() {
        return id;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public List<ShippingQuoteOption> getOptions() {
        return List.copyOf(options);
    }

    public String getDestinationCountry() {
        return destinationCountry;
    }

    public String getDestinationPostal() {
        return destinationPostal;
    }

    public BigDecimal getActualWeightKg() {
        return actualWeightKg;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public boolean isDomestic() {
        return domestic;
    }
}
