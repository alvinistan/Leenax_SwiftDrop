package lk.swiftdrop.catalog.product;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lk.swiftdrop.catalog.category.Category;
import lk.swiftdrop.catalog.category.CategoryRepository;
import lk.swiftdrop.catalog.product.AdminProductResponses.AdminProductDetail;
import lk.swiftdrop.catalog.product.AdminProductResponses.AdminProductSummary;
import lk.swiftdrop.catalog.product.ProductResponses.ProductDetail;
import lk.swiftdrop.catalog.product.ProductResponses.ProductSummary;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.common.web.PageResponse;
import lk.swiftdrop.media.ImageUploads;
import lk.swiftdrop.shipping.audit.ShippingAuditService.Action;
import lk.swiftdrop.shipping.audit.ShippingAuditService;
import lk.swiftdrop.shipping.config.Countries;
import lk.swiftdrop.store.StoreDefaults;
import lk.swiftdrop.tax.TaxRate;
import lk.swiftdrop.tax.TaxRateRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final CategoryRepository categories;
    private final ImageUploads imageUploads;
    private final ShippingAuditService shippingAudit;
    private final TaxRateRepository taxRates;

    public ProductService(ProductRepository products, ProductVariantRepository variants,
                          CategoryRepository categories, ImageUploads imageUploads,
                          ShippingAuditService shippingAudit, TaxRateRepository taxRates) {
        this.taxRates = taxRates;
        this.products = products;
        this.variants = variants;
        this.categories = categories;
        this.imageUploads = imageUploads;
        this.shippingAudit = shippingAudit;
    }

    /** What the shipping change history shows for a product's own restrictions. */
    record ShippingRestrictions(String product, boolean domesticOnly, List<String> blockedCountries) {

        static ShippingRestrictions of(Product product) {
            return new ShippingRestrictions(product.getName(), product.isShippingDomesticOnly(),
                    product.getShippingBlockedCountries());
        }

        boolean isEmpty() {
            return !domesticOnly && blockedCountries.isEmpty();
        }
    }

    // ---- Storefront (customers) ----

    public PageResponse<ProductSummary> listVisible(String categorySlug, Pageable pageable) {
        return PageResponse.from(products.findVisible(categorySlug, pageable),
                product -> ProductSummary.from(product, imageUploads::urlFor));
    }

    public ProductDetail getVisibleBySlug(String slug) {
        Product product = products.findVisibleBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Product", slug));
        return ProductDetail.from(product, imageUploads::urlFor);
    }

    // ---- Admin ----

    /** @param search part of the product name (optional); @param status optional filter */
    public PageResponse<AdminProductSummary> listForAdmin(String search, ProductStatus status, Pageable pageable) {
        return PageResponse.from(
                products.searchForAdmin(status, likePattern(search), pageable),
                product -> AdminProductSummary.from(product, imageUploads::urlFor));
    }

    public AdminProductDetail get(UUID id) {
        return AdminProductDetail.from(find(id), imageUploads::urlFor);
    }

    /**
     * @Transactional: the product and all its variants are saved together, or
     * (if anything fails) none of them are.
     */
    @Transactional
    public AdminProductDetail create(ProductRequest request) {
        if (products.existsBySlug(request.slug())) {
            throw new ConflictException("A product with slug '" + request.slug() + "' already exists.");
        }
        requireNoSkusTaken(variants.findExistingSkus(skusOf(request)));

        Product product = new Product(
                StoreDefaults.DEFAULT_SELLER_ID,
                findCategory(request.categoryId()),
                request.name().trim(),
                request.slug(),
                request.description(),
                request.status(),
                StoreDefaults.DEFAULT_CURRENCY);

        applyShippingDetails(product, request);

        int position = 0;
        for (VariantRequest variant : request.variants()) {
            if (variant.id() != null) {
                throw new ResourceNotFoundException("Variant", variant.id()); // a new product has no variants yet
            }
            product.addVariant(newVariant(variant, position++));
        }
        Product saved = products.save(product);
        ShippingRestrictions restrictions = ShippingRestrictions.of(saved);
        if (!restrictions.isEmpty()) {
            shippingAudit.record("PRODUCT_RESTRICTIONS", saved.getId(), Action.CREATE, null, restrictions);
        }
        return AdminProductDetail.from(saved, imageUploads::urlFor);
    }

    /**
     * Replaces the product and its variant list in ONE transaction:
     * variants with an id are updated, new ones (no id) are added, and
     * existing variants missing from the request are removed.
     */
    @Transactional
    public AdminProductDetail update(UUID id, ProductRequest request) {
        Product product = find(id);
        if (products.existsBySlugAndIdNot(request.slug(), id)) {
            throw new ConflictException("A product with slug '" + request.slug() + "' already exists.");
        }
        requireNoSkusTaken(variants.findSkusUsedByOtherProducts(skusOf(request), id));

        // Security: every variant id must belong to THIS product. Otherwise a crafted
        // request could edit another product's variant by guessing its id ("IDOR").
        Map<UUID, ProductVariant> existing = product.getVariants().stream()
                .collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        Set<UUID> keepIds = new HashSet<>();
        for (VariantRequest variant : request.variants()) {
            if (variant.id() != null) {
                if (!existing.containsKey(variant.id())) {
                    throw new ResourceNotFoundException("Variant", variant.id());
                }
                keepIds.add(variant.id());
            }
        }

        product.update(
                findCategory(request.categoryId()),
                request.name().trim(),
                request.slug(),
                request.description(),
                request.status());

        ShippingRestrictions before = ShippingRestrictions.of(product);
        applyShippingDetails(product, request);
        ShippingRestrictions after = ShippingRestrictions.of(product);
        if (!before.equals(after)) {
            shippingAudit.record("PRODUCT_RESTRICTIONS", product.getId(), Action.UPDATE, before, after);
        }

        // Remove first and write that to the database now, so a SKU freed by a removed
        // variant can be reused by a new one in the same request (the database checks
        // uniqueness on every statement).
        product.removeVariantsExcept(keepIds);
        products.flush();

        int position = 0;
        for (VariantRequest variant : request.variants()) {
            if (variant.id() == null) {
                product.addVariant(newVariant(variant, position));
            } else {
                existing.get(variant.id()).update(
                        variant.sku(),
                        variant.price(),
                        variant.effectiveSaleUnit(),
                        variant.effectiveQuantityRules(),
                        Objects.requireNonNullElse(variant.options(), Map.of()),
                        Objects.requireNonNullElse(variant.active(), true),
                        position,
                        variant.effectiveStockQuantity());
                existing.get(variant.id()).updateShipping(variant.shippingWeightKg(), variant.dimensions());
            }
            position++;
        }
        return AdminProductDetail.from(product, imageUploads::urlFor);
    }

    /**
     * Permanently deletes the product and its variants. Once orders exist
     * (Phase 8), products that were ordered should be ARCHIVED instead.
     */
    @Transactional
    public void delete(UUID id) {
        Product product = find(id);
        // Image rows go with the product (cascade); the files are removed once that is committed.
        product.getImages().forEach(image -> imageUploads.deleteAfterCommit(image.getObjectKey()));
        products.delete(product);
    }

    private void applyShippingDetails(Product product, ProductRequest request) {
        product.updateShippingDetails(
                request.effectiveShippingCategory(),
                blankToNull(request.hsCode()),
                request.effectiveCountryOfOrigin(),
                blankToNull(request.customsDescription()));
        for (String country : request.effectiveShippingBlockedCountries()) {
            if (!Countries.isValid(country)) {
                throw new BadRequestException("Unknown country code: " + country);
            }
        }
        product.updateShippingRestrictions(
                request.effectiveShippingDomesticOnly(), request.effectiveShippingBlockedCountries());
        TaxRate taxRate = request.taxRateId() == null ? null : taxRates.findById(request.taxRateId())
                .orElseThrow(() -> new BadRequestException("Unknown tax rate."));
        product.updateSales(taxRate, Boolean.TRUE.equals(request.codAllowed()));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static ProductVariant newVariant(VariantRequest request, int position) {
        ProductVariant variant = createVariant(request, position);
        variant.updateShipping(request.shippingWeightKg(), request.dimensions());
        return variant;
    }

    private static ProductVariant createVariant(VariantRequest variant, int position) {
        return new ProductVariant(
                variant.sku(),
                variant.price(),
                variant.effectiveSaleUnit(),
                variant.effectiveQuantityRules(),
                Objects.requireNonNullElse(variant.options(), Map.of()),
                Objects.requireNonNullElse(variant.active(), true),
                position,
                variant.effectiveStockQuantity());
    }

    private static List<String> skusOf(ProductRequest request) {
        return request.variants().stream().map(VariantRequest::sku).toList();
    }

    private static void requireNoSkusTaken(List<String> takenSkus) {
        if (!takenSkus.isEmpty()) {
            throw new ConflictException("These SKUs are already used: " + String.join(", ", takenSkus));
        }
    }

    /**
     * "Cake" → "%cake%" for a case-insensitive LIKE search. The LIKE wildcards
     * % and _ (and the escape character itself) are escaped, so they are
     * searched for literally. null/blank → no filter.
     */
    public static String likePattern(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        String escaped = search.trim().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped + "%";
    }

    private Product find(UUID id) {
        return products.findById(id).orElseThrow(() -> new ResourceNotFoundException("Product", id));
    }

    private Category findCategory(UUID id) {
        return categories.findById(id).orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }
}
