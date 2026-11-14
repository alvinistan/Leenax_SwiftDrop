package lk.swiftdrop.cart;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lk.swiftdrop.cart.LinePricing.PricedLine;
import lk.swiftdrop.catalog.product.ProductResponses.QuantityResponse;
import lk.swiftdrop.catalog.product.ProductVariant;
import lk.swiftdrop.catalog.product.ProductVariantRepository;
import lk.swiftdrop.catalog.product.SaleUnit;
import lk.swiftdrop.common.money.MoneyResponse;
import lk.swiftdrop.media.ImageUploads;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/cart/price: the browser keeps only "which variant, how many" (in
 * local storage); the server answers with current names, prices, tax and
 * availability. Prices sent by the browser are not accepted.
 */
@RestController
@RequestMapping("/api/cart")
public class CartController {

    public static final String CURRENCY = "LKR";

    public record CartItem(
            @NotNull UUID variantId,
            @NotNull @DecimalMin(value = "0.001") @Digits(integer = 7, fraction = 3) BigDecimal quantity) {
    }

    public record CartRequest(@NotEmpty @Size(max = 50) List<@Valid @NotNull CartItem> items) {
    }

    /**
     * @param problem null when the line can be ordered; otherwise why not (shown to the customer)
     */
    public record CartLine(UUID variantId, String productName, String productSlug, String variantLabel,
                           SaleUnit saleUnit, QuantityResponse rules, BigDecimal quantity, MoneyResponse unitPrice,
                           MoneyResponse lineTotal,
                           MoneyResponse taxIncluded, String taxName, boolean codAllowed, String imageUrl,
                           String problem) {
    }

    public record CartResponse(List<CartLine> lines, MoneyResponse itemsTotal, MoneyResponse taxIncluded,
                               boolean orderable) {
    }

    private final ProductVariantRepository variants;
    private final ImageUploads images;

    public CartController(ProductVariantRepository variants, ImageUploads images) {
        this.variants = variants;
        this.images = images;
    }

    @PostMapping("/price")
    @Transactional(readOnly = true)
    public ResponseEntity<CartResponse> price(@Valid @RequestBody CartRequest request) {
        Map<UUID, ProductVariant> found = variants.findAllWithProductByIdIn(
                        request.items().stream().map(CartItem::variantId).toList())
                .stream().collect(Collectors.toMap(ProductVariant::getId, Function.identity()));

        List<CartLine> lines = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO.setScale(2);
        BigDecimal tax = BigDecimal.ZERO.setScale(2);
        boolean orderable = true;
        for (CartItem item : request.items()) {
            ProductVariant variant = found.get(item.variantId());
            if (variant == null || !LinePricing.isForSale(variant)) {
                // Same answer for "deleted" and "hidden": nothing about drafts leaks.
                lines.add(new CartLine(item.variantId(), null, null, null, null, null, item.quantity(), null, null, null,
                        null, false, null, "This item is no longer available."));
                orderable = false;
                continue;
            }
            String problem = null;
            if (!variant.getQuantityRules().allows(item.quantity())) {
                problem = "This quantity is not allowed. Please change it.";
            } else if (variant.getStockQuantity().compareTo(item.quantity()) < 0) {
                problem = variant.getStockQuantity().compareTo(variant.getQuantityRules().minQuantity()) < 0
                        ? "Out of stock." : "Only a smaller quantity is in stock.";
            }
            PricedLine priced = LinePricing.price(variant, item.quantity());
            var product = variant.getProduct();
            lines.add(new CartLine(variant.getId(), product.getName(), product.getSlug(),
                    LinePricing.variantLabel(variant), variant.getSaleUnit(),
                    QuantityResponse.from(variant.getQuantityRules()), item.quantity(),
                    MoneyResponse.of(priced.unitPrice(), CURRENCY), MoneyResponse.of(priced.lineTotal(), CURRENCY),
                    MoneyResponse.of(priced.taxIncluded(), CURRENCY), priced.taxName(), product.isCodAllowed(),
                    images.urlFor(product.mainImageKey().orElse(null)), problem));
            if (problem == null) {
                total = total.add(priced.lineTotal());
                tax = tax.add(priced.taxIncluded());
            } else {
                orderable = false;
            }
        }
        return ResponseEntity.ok(new CartResponse(lines, MoneyResponse.of(total, CURRENCY),
                MoneyResponse.of(tax, CURRENCY), orderable));
    }
}
