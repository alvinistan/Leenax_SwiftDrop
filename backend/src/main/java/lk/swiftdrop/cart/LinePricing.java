package lk.swiftdrop.cart;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.TreeMap;
import lk.swiftdrop.catalog.product.Product;
import lk.swiftdrop.catalog.product.ProductStatus;
import lk.swiftdrop.catalog.product.ProductVariant;
import lk.swiftdrop.tax.TaxCalculator;

/**
 * Prices one cart or order line FROM THE DATABASE (never from the browser):
 * unit price × quantity, and the tax included in it. Shared by the cart and
 * by order placement so both always agree.
 */
public final class LinePricing {

    private LinePricing() {
    }

    public record PricedLine(ProductVariant variant, BigDecimal quantity, BigDecimal unitPrice, BigDecimal lineTotal,
                             String taxName, BigDecimal taxPercent, BigDecimal taxIncluded) {
    }

    public static PricedLine price(ProductVariant variant, BigDecimal quantity) {
        BigDecimal unit = variant.getPrice().setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = unit.multiply(quantity).setScale(2, RoundingMode.HALF_UP);
        var taxRate = variant.getProduct().getTaxRate();
        BigDecimal percent = taxRate == null ? BigDecimal.ZERO : taxRate.getPercent();
        return new PricedLine(variant, quantity, unit, total, taxRate == null ? null : taxRate.getName(), percent,
                TaxCalculator.includedTax(total, percent));
    }

    /** Can customers buy this right now (product, category and variant all visible)? */
    public static boolean isForSale(ProductVariant variant) {
        Product product = variant.getProduct();
        return variant.isActive() && product.getStatus() == ProductStatus.ACTIVE && product.getCategory().isActive();
    }

    /** "1 kg / Chocolate", or "Standard" when the variant has no options. Options sorted by name. */
    public static String variantLabel(ProductVariant variant) {
        Map<String, String> sorted = new TreeMap<>(variant.getOptions());
        return sorted.isEmpty() ? "Standard" : String.join(" / ", sorted.values());
    }
}
