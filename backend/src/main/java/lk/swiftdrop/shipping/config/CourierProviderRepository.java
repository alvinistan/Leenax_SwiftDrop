package lk.swiftdrop.shipping.config;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourierProviderRepository extends JpaRepository<CourierProviderConfig, UUID> {

    @EntityGraph(attributePaths = "services")
    List<CourierProviderConfig> findAllByOrderByNameAsc();
}
