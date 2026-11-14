package lk.swiftdrop.order;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.math.BigDecimal;
import java.util.UUID;
import lk.swiftdrop.catalog.product.SaleUnit;

/** A SNAPSHOT of one ordered line: later product or price changes do not change it. */
@Embeddable
public record OrderItem(
        @Column(name = "variant_id", nullable = false) UUID variantId,
        @Column(name = "product_name", nullable = false, length = 200) String productName,
        @Column(name = "variant_label", nullable = false, length = 200) String variantLabel,
        @Column(nullable = false, length = 64) String sku,
        @Enumerated(EnumType.STRING) @Column(name = "sale_unit", nullable = false, length = 10) SaleUnit saleUnit,
        @Column(nullable = false, precision = 10, scale = 3) BigDecimal quantity,
        @Column(name = "unit_price", nullable = false, precision = 19, scale = 2) BigDecimal unitPrice,
        @Column(name = "line_total", nullable = false, precision = 19, scale = 2) BigDecimal lineTotal,
        @Column(name = "tax_name", length = 60) String taxName,
        @Column(name = "tax_percent", nullable = false, precision = 5, scale = 2) BigDecimal taxPercent,
        @Column(name = "tax_included", nullable = false, precision = 19, scale = 2) BigDecimal taxIncluded) {
}
