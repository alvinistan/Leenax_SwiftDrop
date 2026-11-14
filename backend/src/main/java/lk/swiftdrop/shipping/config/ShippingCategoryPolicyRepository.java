package lk.swiftdrop.shipping.config;

import lk.swiftdrop.catalog.product.ShippingCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShippingCategoryPolicyRepository extends JpaRepository<ShippingCategoryPolicy, ShippingCategory> {
}
