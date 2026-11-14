package lk.swiftdrop.shipping.config;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ShippingDestinationRepository extends JpaRepository<ShippingDestination, String> {
}
