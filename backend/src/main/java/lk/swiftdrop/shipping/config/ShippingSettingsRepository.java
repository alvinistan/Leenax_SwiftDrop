package lk.swiftdrop.shipping.config;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ShippingSettingsRepository extends JpaRepository<ShippingSettings, Short> {
}
