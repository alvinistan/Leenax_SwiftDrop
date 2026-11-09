package lk.swiftdrop.catalog.product;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import lk.swiftdrop.catalog.product.ProductResponses.CategoryRef;
import lk.swiftdrop.catalog.product.ProductResponses.QuantityResponse;
import lk.swiftdrop.common.money.MoneyResponse;

/**
 * What the ADMIN API returns. Separate from the customer responses on purpose:
 * admin-only data (exact stock, inactive variants, drafts) can never leak into
 * the public API by accident.
 */
public final class AdminProductResponses {

    private AdminProductResponses() {
    }

    public record AdminProductSummary(
            UUID id,
            String name,
            String slug,
            CategoryRef category,
            ProductStatus status,
            int variantCount,
            MoneyResponse fromPrice,
            SaleUnit fromPriceUnit,
            boolean inStock) {

        static AdminProductSummary from(Product product) {
            var cheapest = product.cheapestActiveVariant();
            return new AdminProductSummary(
                    product.getId(),
                    product.getName(),
                    product.getSlug(),
                    CategoryRef.from(product.getCategory()),
                    product.getStatus(),
                    product.getVariants().size(),
                    cheapest.map(v -> MoneyResponse.of(v.getPrice(), product.getCurrency())).orElse(null),
                    cheapest.map(ProductVariant::getSaleUnit).orElse(null),
                    product.isInStock());
        }
    }

    public record AdminVariant(
            UUID id,
            String sku,
            MoneyResponse price,
            SaleUnit saleUnit,
            QuantityResponse quantity,
            Map<String, String> options,
            boolean active,
            /** Exact stock, e.g. "12" pieces or "3.5" kg. Admin only. */
            String stockQuantity,
            boolean inStock) {

        static AdminVariant from(ProductVariant variant, String currency) {
            return new AdminVariant(
                    variant.getId(),
                    variant.getSku(),
                    MoneyResponse.of(variant.getPrice(), currency),
                    variant.getSaleUnit(),
                    QuantityResponse.from(variant.getQuantityRules()),
                    new TreeMap<>(variant.getOptions()),
                    variant.isActive(),
                    QuantityResponse.plain(variant.getStockQuantity()),
                    variant.isInStock());
        }
    }

    public record AdminProductDetail(
            UUID id,
            String name,
            String slug,
            String description,
            CategoryRef category,
            ProductStatus status,
            String currency,
            /** All variants, including inactive ones. */
            List<AdminVariant> variants) {

        static AdminProductDetail from(Product product) {
            return new AdminProductDetail(
                    product.getId(),
                    product.getName(),
                    product.getSlug(),
                    product.getDescription(),
                    CategoryRef.from(product.getCategory()),
                    product.getStatus(),
                    product.getCurrency(),
                    product.getVariants().stream()
                            .map(v -> AdminVariant.from(v, product.getCurrency()))
                            .toList());
        }
    }
}
