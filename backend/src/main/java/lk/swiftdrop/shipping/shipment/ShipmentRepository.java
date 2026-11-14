package lk.swiftdrop.shipping.shipment;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ShipmentRepository extends JpaRepository<Shipment, UUID> {

    /** :pattern is an escaped, lower-case LIKE pattern (see ProductService.likePattern). */
    @EntityGraph(attributePaths = "provider")
    @Query("""
            SELECT s FROM Shipment s
            WHERE (:status IS NULL OR s.status = :status)
              AND (:providerId IS NULL OR s.provider.id = :providerId)
              AND (:pattern IS NULL
                   OR LOWER(s.orderReference) LIKE :pattern ESCAPE '\\'
                   OR LOWER(s.awb) LIKE :pattern ESCAPE '\\')
            """)
    Page<Shipment> search(@Param("status") TrackingStatus status, @Param("providerId") UUID providerId,
                          @Param("pattern") String pattern, Pageable pageable);

    @EntityGraph(attributePaths = {"provider", "service", "events"})
    Optional<Shipment> findWithEventsById(UUID id);

    boolean existsByProviderIdAndAwbIgnoreCase(UUID providerId, String awb);

    boolean existsByProviderIdAndAwbIgnoreCaseAndIdNot(UUID providerId, String awb, UUID id);
}
