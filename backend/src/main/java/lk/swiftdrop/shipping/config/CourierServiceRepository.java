package lk.swiftdrop.shipping.config;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourierServiceRepository extends JpaRepository<CourierServiceConfig, UUID> {
}
