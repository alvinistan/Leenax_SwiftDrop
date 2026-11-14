package lk.swiftdrop.shipping.quote;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShippingQuoteOptionRepository extends JpaRepository<ShippingQuoteOption, UUID> {

    @EntityGraph(attributePaths = "quote")
    Optional<ShippingQuoteOption> findWithQuoteById(UUID id);
}
