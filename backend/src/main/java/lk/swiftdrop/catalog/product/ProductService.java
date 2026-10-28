package lk.swiftdrop.catalog.product;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lk.swiftdrop.catalog.category.Category;
import lk.swiftdrop.catalog.category.CategoryRepository;
import lk.swiftdrop.catalog.product.ProductResponses.ProductDetail;
import lk.swiftdrop.catalog.product.ProductResponses.ProductSummary;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.common.web.PageResponse;
import lk.swiftdrop.store.StoreDefaults;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final CategoryRepository categories;

    public ProductService(
            ProductRepository products, ProductVariantRepository variants, CategoryRepository categories) {
        this.products = products;
        this.variants = variants;
        this.categories = categories;
    }

    // ---- Storefront (customers) ----

    public PageResponse<ProductSummary> listVisible(String categorySlug, Pageable pageable) {
        return PageResponse.from(products.findVisible(categorySlug, pageable), ProductSummary::from);
    }

    public ProductDetail getVisibleBySlug(String slug) {
        Product product = products.findVisibleBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Product", slug));
        return ProductDetail.from(product, false);
    }

    // ---- Admin ----

    public PageResponse<ProductSummary> listAll(Pageable pageable) {
        return PageResponse.from(products.findAllBy(pageable), ProductSummary::from);
    }

    public ProductDetail get(UUID id) {
        return ProductDetail.from(find(id), true);
    }

    /**
     * @Transactional: the product and all its variants are saved together, or
     * (if anything fails) none of them are.
     */
    @Transactional
    public ProductDetail create(ProductRequest request) {
        if (products.existsBySlug(request.slug())) {
            throw new ConflictException("A product with slug '" + request.slug() + "' already exists.");
        }
        List<String> skus = request.variants().stream().map(VariantRequest::sku).toList();
        List<String> takenSkus = variants.findExistingSkus(skus);
        if (!takenSkus.isEmpty()) {
            throw new ConflictException("These SKUs are already used: " + String.join(", ", takenSkus));
        }

        Product product = new Product(
                StoreDefaults.DEFAULT_SELLER_ID,
                findCategory(request.categoryId()),
                request.name().trim(),
                request.slug(),
                request.description(),
                request.status(),
                StoreDefaults.DEFAULT_CURRENCY);

        int position = 0;
        for (VariantRequest variant : request.variants()) {
            product.addVariant(new ProductVariant(
                    variant.sku(),
                    variant.price(),
                    Objects.requireNonNullElse(variant.options(), Map.of()),
                    Objects.requireNonNullElse(variant.active(), true),
                    position++));
        }
        return ProductDetail.from(products.save(product), true);
    }

    @Transactional
    public ProductDetail update(UUID id, ProductUpdateRequest request) {
        Product product = find(id);
        if (products.existsBySlugAndIdNot(request.slug(), id)) {
            throw new ConflictException("A product with slug '" + request.slug() + "' already exists.");
        }
        product.update(
                findCategory(request.categoryId()),
                request.name().trim(),
                request.slug(),
                request.description(),
                request.status());
        return ProductDetail.from(product, true);
    }

    /**
     * Permanently deletes the product and its variants. Once orders exist
     * (Phase 8), products that were ordered should be ARCHIVED instead.
     */
    @Transactional
    public void delete(UUID id) {
        products.delete(find(id));
    }

    private Product find(UUID id) {
        return products.findById(id).orElseThrow(() -> new ResourceNotFoundException("Product", id));
    }

    private Category findCategory(UUID id) {
        return categories.findById(id).orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }
}
