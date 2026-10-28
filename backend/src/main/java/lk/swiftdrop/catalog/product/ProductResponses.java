package lk.swiftdrop.catalog.product;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import lk.swiftdrop.catalog.category.Category;
import lk.swiftdrop.common.money.MoneyResponse;

/** The JSON shapes the product API returns. Grouped in one file because they belong together. */
public final class ProductResponses {

    private ProductResponses() {
    }

    public record CategoryRef(UUID id, String name, String slug) {

        static CategoryRef from(Category category) {
            return new CategoryRef(category.getId(), category.getName(), category.getSlug());
        }
    }

    /** For product lists (cards): no variants, just the lowest price. */
    public record ProductSummary(
            UUID id,
            String name,
            String slug,
            CategoryRef category,
            /** Lowest active variant price; null if no variant is active. */
            MoneyResponse fromPrice,
            ProductStatus status) {

        static ProductSummary from(Product product) {
            return new ProductSummary(
                    product.getId(),
                    product.getName(),
                    product.getSlug(),
                    CategoryRef.from(product.getCategory()),
                    product.lowestActivePrice()
                            .map(price -> MoneyResponse.of(price, product.getCurrency()))
                            .orElse(null),
                    product.getStatus());
        }
    }

    public record VariantResponse(
            UUID id,
            String sku,
            MoneyResponse price,
            /** Sorted by option name so the JSON order is predictable. */
            Map<String, String> options,
            boolean active) {

        static VariantResponse from(ProductVariant variant, String currency) {
            return new VariantResponse(
                    variant.getId(),
                    variant.getSku(),
                    MoneyResponse.of(variant.getPrice(), currency),
                    new TreeMap<>(variant.getOptions()),
                    variant.isActive());
        }
    }

    /** For the product page: everything, including variants. */
    public record ProductDetail(
            UUID id,
            String name,
            String slug,
            String description,
            CategoryRef category,
            ProductStatus status,
            String currency,
            List<VariantResponse> variants) {

        /** @param includeInactiveVariants true for admins; customers only see active variants. */
        static ProductDetail from(Product product, boolean includeInactiveVariants) {
            return new ProductDetail(
                    product.getId(),
                    product.getName(),
                    product.getSlug(),
                    product.getDescription(),
                    CategoryRef.from(product.getCategory()),
                    product.getStatus(),
                    product.getCurrency(),
                    product.getVariants().stream()
                            .filter(variant -> includeInactiveVariants || variant.isActive())
                            .map(variant -> VariantResponse.from(variant, product.getCurrency()))
                            .toList());
        }
    }
}
