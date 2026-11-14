package lk.swiftdrop.catalog.product;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
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
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
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

    @Enumerated(EnumType.STRING)
    @Column(name = "shipping_category", nullable = false, length = 30)
    private ShippingCategory shippingCategory = ShippingCategory.GENERAL;

    /** Harmonized System code for customs, e.g. "0305.59"; null if not set. */
    @Column(name = "hs_code", length = 13)
    private String hsCode;

    /** ISO 3166 country code, e.g. "LK". CHAR(2) in the database. */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "country_of_origin", nullable = false, length = 2)
    private String countryOfOrigin = "LK";

    @Column(name = "customs_description", length = 200)
    private String customsDescription;

    /** This product goes to the origin country (Sri Lanka) only, whatever its shipping category allows. */
    @Column(name = "shipping_domestic_only", nullable = false)
    private boolean shippingDomesticOnly;

    /** Countries this product may not be sent to, on top of its shipping category's blocked countries. */
    @ElementCollection
    @CollectionTable(name = "product_shipping_blocked_countries", joinColumns = @JoinColumn(name = "product_id"))
    @Column(name = "country_code", length = 2, nullable = false)
    private Set<String> shippingBlockedCountries = new TreeSet<>();

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

    /** Photos, first one = the main photo. Rows are deleted with the product (files: see ProductService). */
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, createdAt ASC")
    private List<ProductImage> images = new ArrayList<>();

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

    public void updateShippingDetails(
            ShippingCategory shippingCategory, String hsCode, String countryOfOrigin, String customsDescription) {
        this.shippingCategory = shippingCategory;
        this.hsCode = hsCode;
        this.countryOfOrigin = countryOfOrigin;
        this.customsDescription = customsDescription;
    }

    /** Product-level restrictions. They only ADD to the category's rules. */
    public void updateShippingRestrictions(boolean domesticOnly, Collection<String> blockedCountries) {
        this.shippingDomesticOnly = domesticOnly;
        this.shippingBlockedCountries.clear();
        this.shippingBlockedCountries.addAll(blockedCountries);
    }

    /** May this product (by its own rules) be delivered to the destination? */
    public boolean shippingAllows(String destinationCountry, boolean domestic) {
        if (domestic) {
            return true;
        }
        return !shippingDomesticOnly && !shippingBlockedCountries.contains(destinationCountry);
    }

    public boolean isShippingDomesticOnly() {
        return shippingDomesticOnly;
    }

    /** Sorted A–Z. */
    public List<String> getShippingBlockedCountries() {
        return List.copyOf(new TreeSet<>(shippingBlockedCountries));
    }

    /** Ready for shipping quotes: every active variant has a shipping weight. */
    public boolean isShippingReady() {
        return variants.stream().filter(ProductVariant::isActive).allMatch(v -> v.getShippingWeightKg() != null);
    }

    public ShippingCategory getShippingCategory() {
        return shippingCategory;
    }

    public String getHsCode() {
        return hsCode;
    }

    public String getCountryOfOrigin() {
        return countryOfOrigin;
    }

    public String getCustomsDescription() {
        return customsDescription;
    }

    public void addVariant(ProductVariant variant) {
        variant.assignTo(this);
        variants.add(variant);
    }

    /** Removes the variants whose id is not in keepIds (orphanRemoval deletes their rows). */
    public void removeVariantsExcept(java.util.Set<UUID> keepIds) {
        variants.removeIf(variant -> !keepIds.contains(variant.getId()));
    }

    public ProductImage addImage(String objectKey, String contentType, long sizeBytes, String altText) {
        int nextOrder = images.stream().mapToInt(ProductImage::getSortOrder).max().orElse(-1) + 1;
        ProductImage image = new ProductImage(this, objectKey, contentType, sizeBytes, altText, nextOrder);
        images.add(image);
        return image;
    }

    public void removeImage(ProductImage image) {
        images.remove(image);
    }

    public List<ProductImage> getImages() {
        return Collections.unmodifiableList(images);
    }

    /** The main photo's storage key, if there is a photo. */
    public Optional<String> mainImageKey() {
        return images.stream().findFirst().map(ProductImage::getObjectKey);
    }

    /** Is any active variant available to buy? */
    public boolean isInStock() {
        return variants.stream().anyMatch(v -> v.isActive() && v.isInStock());
    }

    /** The active variant with the lowest price, used for "from LKR 1,450.00" on product cards. */
    public Optional<ProductVariant> cheapestActiveVariant() {
        return variants.stream()
                .filter(ProductVariant::isActive)
                .min(Comparator.comparing(ProductVariant::getPrice));
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
