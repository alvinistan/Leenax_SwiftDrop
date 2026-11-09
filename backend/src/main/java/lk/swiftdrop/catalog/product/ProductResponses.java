package lk.swiftdrop.catalog.product;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import lk.swiftdrop.catalog.category.Category;
import lk.swiftdrop.common.money.MoneyResponse;

/** The JSON shapes the product API returns. Grouped in one file because they belong together. */
public final class ProductResponses {

    private ProductResponses() {
    }

    public record CategoryRef(UUID id, String name, String slug) {

        public static CategoryRef from(Category category) {
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
            ProductStatus status,
            /** Can any active variant be bought? (Exact stock is never shown to customers.) */
            boolean inStock,
            /** The main photo (short-lived link), or null. */
            String imageUrl) {

        /** @param imageUrl turns a storage key into a link a browser can show */
        static ProductSummary from(Product product, Function<String, String> imageUrl) {
            var cheapest = product.cheapestActiveVariant();
            return new ProductSummary(
                    product.getId(),
                    product.getName(),
                    product.getSlug(),
                    CategoryRef.from(product.getCategory()),
                    cheapest.map(v -> MoneyResponse.of(v.getPrice(), product.getCurrency())).orElse(null),
                    cheapest.map(ProductVariant::getSaleUnit).orElse(null),
                    product.getStatus(),
                    product.isInStock(),
                    product.mainImageKey().map(imageUrl).orElse(null));
        }
    }

    /** A photo as customers get it. */
    public record ImageResponse(String url, String altText) {
    }

    /** Allowed quantities, as decimal strings: {"min": "0.5", "max": "5", "step": "0.5"}. */
    public record QuantityResponse(String min, String max, String step) {

        public static QuantityResponse from(QuantityRules rules) {
            return new QuantityResponse(plain(rules.minQuantity()), plain(rules.maxQuantity()), plain(rules.step()));
        }

        static String plain(BigDecimal value) {
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
            boolean active,
            boolean inStock) {

        static VariantResponse from(ProductVariant variant, String currency) {
            return new VariantResponse(
                    variant.getId(),
                    variant.getSku(),
                    MoneyResponse.of(variant.getPrice(), currency),
                    variant.getSaleUnit(),
                    QuantityResponse.from(variant.getQuantityRules()),
                    new TreeMap<>(variant.getOptions()),
                    variant.isActive(),
                    variant.isInStock());
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
            List<VariantResponse> variants,
            /** In display order; the first is the main photo. */
            List<ImageResponse> images) {

        /** Customers only see active variants. (Admins use AdminProductResponses.) */
        static ProductDetail from(Product product, Function<String, String> imageUrl) {
            return new ProductDetail(
                    product.getId(),
                    product.getName(),
                    product.getSlug(),
                    product.getDescription(),
                    CategoryRef.from(product.getCategory()),
                    product.getStatus(),
                    product.getCurrency(),
                    product.getVariants().stream()
                            .filter(ProductVariant::isActive)
                            .map(variant -> VariantResponse.from(variant, product.getCurrency()))
                            .toList(),
                    product.getImages().stream()
                            .map(image -> new ImageResponse(imageUrl.apply(image.getObjectKey()), image.getAltText()))
                            .toList());
        }
    }
}
