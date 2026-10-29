package lk.swiftdrop.catalog.product;

import java.math.BigDecimal;
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
            /** What fromPrice is per: PIECE or KG ("from LKR 4,500.00 / kg"). */
            SaleUnit fromPriceUnit,
            ProductStatus status) {

        static ProductSummary from(Product product) {
            var cheapest = product.cheapestActiveVariant();
            return new ProductSummary(
                    product.getId(),
                    product.getName(),
                    product.getSlug(),
                    CategoryRef.from(product.getCategory()),
                    cheapest.map(v -> MoneyResponse.of(v.getPrice(), product.getCurrency())).orElse(null),
                    cheapest.map(ProductVariant::getSaleUnit).orElse(null),
                    product.getStatus());
        }
    }

    /** Allowed quantities, as decimal strings: {"min": "0.5", "max": "5", "step": "0.5"}. */
    public record QuantityResponse(String min, String max, String step) {

        static QuantityResponse from(QuantityRules rules) {
            return new QuantityResponse(plain(rules.minQuantity()), plain(rules.maxQuantity()), plain(rules.step()));
        }

        private static String plain(BigDecimal value) {
            return value == null ? null : value.stripTrailingZeros().toPlainString();
        }
    }

    public record VariantResponse(
            UUID id,
            String sku,
            /** Price per saleUnit: per piece, or per kg. */
            MoneyResponse price,
            SaleUnit saleUnit,
            QuantityResponse quantity,
            /** Sorted by option name so the JSON order is predictable. */
            Map<String, String> options,
            boolean active) {

        static VariantResponse from(ProductVariant variant, String currency) {
            return new VariantResponse(
                    variant.getId(),
                    variant.getSku(),
                    MoneyResponse.of(variant.getPrice(), currency),
                    variant.getSaleUnit(),
                    QuantityResponse.from(variant.getQuantityRules()),
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
