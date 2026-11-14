package lk.swiftdrop.order;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lk.swiftdrop.catalog.product.Product;
import lk.swiftdrop.catalog.product.ProductVariant;
import lk.swiftdrop.catalog.product.ProductVariantRepository;
import lk.swiftdrop.order.DispatchCheck.ProductFacts;
import lk.swiftdrop.order.DispatchCheck.Result;
import lk.swiftdrop.shipping.config.ShippingCategoryPolicy;
import lk.swiftdrop.shipping.config.ShippingCategoryPolicyRepository;
import lk.swiftdrop.shipping.config.ShippingConfigService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies DispatchCheck to an order with the current product and shipping data. */
@Service
@Transactional(readOnly = true)
public class DispatchService {

    private final ProductVariantRepository variants;
    private final ShippingConfigService shippingConfig;
    private final ShippingCategoryPolicyRepository policies;

    public DispatchService(ProductVariantRepository variants, ShippingConfigService shippingConfig,
                           ShippingCategoryPolicyRepository policies) {
        this.variants = variants;
        this.shippingConfig = shippingConfig;
        this.policies = policies;
    }

    public Result check(CustomerOrder order) {
        String country = order.getAddress().countryCode();
        boolean domestic = country.equals(shippingConfig.currentSettings().getOriginCountry());
        Map<UUID, ProductVariant> found = variants.findAllWithProductByIdIn(
                        order.getItems().stream().map(OrderItem::variantId).toList())
                .stream().collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        Map<?, ShippingCategoryPolicy> policyMap = policies.findAll().stream()
                .collect(Collectors.toMap(ShippingCategoryPolicy::getCategory, Function.identity()));

        List<ProductFacts> facts = order.getItems().stream().map(item -> {
            ProductVariant variant = found.get(item.variantId());
            if (variant == null) {
                return new ProductFacts(item.productName(), false, true);
            }
            Product product = variant.getProduct();
            boolean customs = product.getHsCode() != null && product.getCustomsDescription() != null;
            ShippingCategoryPolicy policy = policyMap.get(product.getShippingCategory());
            boolean allowed = (policy == null || policy.allows(country, domestic))
                    && product.shippingAllows(country, domestic);
            return new ProductFacts(item.productName(), customs, allowed);
        }).distinct().toList();

        return DispatchCheck.evaluate(order.getStatus(), order.getPaymentMethod(), order.getPaymentStatus(), domestic,
                facts);
    }
}
