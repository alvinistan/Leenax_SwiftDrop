package lk.swiftdrop.shipping.pricing;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RateCardRepository extends JpaRepository<RateCard, UUID> {

    @EntityGraph(attributePaths = {"service", "service.provider"})
    List<RateCard> findAllByOrderByCountryCodeAsc();

    Optional<RateCard> findByServiceIdAndCountryCodeAndEnabledTrue(UUID serviceId, String countryCode);

    boolean existsByServiceIdAndCountryCodeAndIdNot(UUID serviceId, String countryCode, UUID id);

    boolean existsByServiceIdAndCountryCode(UUID serviceId, String countryCode);
}
