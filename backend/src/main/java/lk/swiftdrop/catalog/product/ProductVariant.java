package lk.swiftdrop.catalog.product;

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
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** A sellable version of a product, e.g. "T-shirt, size M, red". Has its own SKU and price. */
@Entity
@Table(name = "product_variants")
public class ProductVariant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Many variants belong to one product. LAZY: load the product only if needed. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, length = 64, unique = true)
    private String sku;

    /** BigDecimal: exact decimal arithmetic. Never use double for money. */
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal price;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    /** Option name → value, e.g. {Size=M, Colour=Red}. Stored in product_variant_options. */
    @ElementCollection
    @CollectionTable(name = "product_variant_options", joinColumns = @JoinColumn(name = "variant_id"))
    @MapKeyColumn(name = "option_name", length = 50)
    @Column(name = "option_value", nullable = false, length = 100)
    private Map<String, String> options = new HashMap<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProductVariant() {
    }

    public ProductVariant(String sku, BigDecimal price, Map<String, String> options, boolean active, int sortOrder) {
        this.sku = sku;
        this.price = price;
        this.options = new HashMap<>(options);
        this.active = active;
        this.sortOrder = sortOrder;
    }

    /** Called by Product.addVariant to keep both sides of the relationship in sync. */
    void assignTo(Product product) {
        this.product = product;
    }

    public UUID getId() {
        return id;
    }

    public String getSku() {
        return sku;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public boolean isActive() {
        return active;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public Map<String, String> getOptions() {
        return Map.copyOf(options);
    }
}
