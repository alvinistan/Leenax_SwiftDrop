package lk.swiftdrop.tax;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** A tax that is INCLUDED in product prices, e.g. "VAT 18%". Chosen per product. */
@Entity
@Table(name = "tax_rates")
public class TaxRate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 60)
    private String name;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal percent;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TaxRate() {
    }

    public TaxRate(String name, BigDecimal percent) {
        update(name, percent);
    }

    public void update(String name, BigDecimal percent) {
        this.name = name;
        this.percent = percent;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getPercent() {
        return percent;
    }
}
