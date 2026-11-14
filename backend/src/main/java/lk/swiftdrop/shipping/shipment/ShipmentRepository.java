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
              AND (:activeOnly = false OR s.status NOT IN (
                    lk.swiftdrop.shipping.shipment.TrackingStatus.DELIVERED,
                    lk.swiftdrop.shipping.shipment.TrackingStatus.RETURNED,
                    lk.swiftdrop.shipping.shipment.TrackingStatus.CANCELLED))
              AND (:providerId IS NULL OR s.provider.id = :providerId)
              AND (:pattern IS NULL
                   OR LOWER(s.orderReference) LIKE :pattern ESCAPE '\\'
                   OR LOWER(s.awb) LIKE :pattern ESCAPE '\\')
            """)
    Page<Shipment> search(@Param("status") TrackingStatus status, @Param("providerId") UUID providerId,
                          @Param("pattern") String pattern, @Param("activeOnly") boolean activeOnly,
                          Pageable pageable);

    /** Parcels of one website order, oldest first. */
    @EntityGraph(attributePaths = {"provider", "events"})
    java.util.List<Shipment> findAllByOrderIdOrderByCreatedAtAsc(UUID orderId);

    /** Shipments created in a period, for the expenses report. */
    @EntityGraph(attributePaths = {"provider", "order"})
    java.util.List<Shipment> findAllByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
            java.time.Instant from, java.time.Instant to);

    @EntityGraph(attributePaths = {"provider", "service", "events"})
    Optional<Shipment> findWithEventsById(UUID id);

    boolean existsByProviderIdAndAwbIgnoreCase(UUID providerId, String awb);

    boolean existsByProviderIdAndAwbIgnoreCaseAndIdNot(UUID providerId, String awb, UUID id);

    /** Shipments created in a period with their tracking steps, for the reports. */
    @EntityGraph(attributePaths = {"provider", "order", "events"})
    @org.springframework.data.jpa.repository.Query("""
            SELECT DISTINCT s FROM Shipment s
            WHERE s.createdAt >= :from AND s.createdAt < :to
            """)
    java.util.List<Shipment> findForReport(@Param("from") java.time.Instant from, @Param("to") java.time.Instant to);
}
