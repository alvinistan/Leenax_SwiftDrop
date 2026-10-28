package lk.swiftdrop.catalog.product;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lk.swiftdrop.catalog.category.Category;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * Stored as a plain id for now. A Seller entity is added when sellers can be
     * managed (Phase 15); the column and foreign key already exist.
     */
    @Column(name = "seller_id", nullable = false, updatable = false)
    private UUID sellerId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 200, unique = true)
    private String slug;

    @Column(columnDefinition = "text")
    private String description;

    /** STRING, not ORDINAL: the database stores "ACTIVE", which survives reordering the enum. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProductStatus status;

    /** CHAR(3) in the database (always exactly 3 letters, e.g. LKR), so tell Hibernate it is not VARCHAR. */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(nullable = false, length = 3, updatable = false)
    private String currency;

    /**
     * Optimistic locking: Hibernate adds "WHERE version = ?" to every UPDATE. If
     * another transaction changed the row first, the update fails instead of
     * silently overwriting that change.
     */
    @Version
    private long version;

    /** cascade ALL + orphanRemoval: variants are saved and deleted together with the product. */
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProductVariant> variants = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Product() {
    }

    public Product(UUID sellerId, Category category, String name, String slug, String description,
                   ProductStatus status, String currency) {
        this.sellerId = sellerId;
        this.currency = currency;
        update(category, name, slug, description, status);
    }

    public void update(Category category, String name, String slug, String description, ProductStatus status) {
        this.category = category;
        this.name = name;
        this.slug = slug;
        this.description = description;
        this.status = status;
    }

    public void addVariant(ProductVariant variant) {
        variant.assignTo(this);
        variants.add(variant);
    }

    /** The lowest price among active variants, used for "from LKR 1,450.00" on product cards. */
    public Optional<BigDecimal> lowestActivePrice() {
        return variants.stream()
                .filter(ProductVariant::isActive)
                .map(ProductVariant::getPrice)
                .min(Comparator.naturalOrder());
    }

    public UUID getId() {
        return id;
    }

    public UUID getSellerId() {
        return sellerId;
    }

    public Category getCategory() {
        return category;
    }

    public String getName() {
        return name;
    }

    public String getSlug() {
        return slug;
    }

    public String getDescription() {
        return description;
    }

    public ProductStatus getStatus() {
        return status;
    }

    public String getCurrency() {
        return currency;
    }

    public List<ProductVariant> getVariants() {
        return Collections.unmodifiableList(variants);
    }
}
