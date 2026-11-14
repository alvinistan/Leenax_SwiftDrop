package lk.swiftdrop.shipping.quote;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShippingQuoteRepository extends JpaRepository<ShippingQuote, UUID> {
}
