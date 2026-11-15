package lk.swiftdrop.delivery;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CodCollectionRepository extends JpaRepository<CodCollection, UUID> {

    boolean existsByOrderId(UUID orderId);

    Optional<CodCollection> findByOrderIdAndStatus(UUID orderId, CodCollection.Status status);

    @EntityGraph(attributePaths = {"order", "shipment", "heldByProvider", "heldByUser"})
    List<CodCollection> findAllByStatusOrderByCollectedAtAsc(CodCollection.Status status);

    @EntityGraph(attributePaths = {"order", "shipment", "heldByProvider", "heldByUser"})
    List<CodCollection> findTop100ByStatusOrderBySettledAtDesc(CodCollection.Status status);

    @EntityGraph(attributePaths = {"order", "shipment", "heldByProvider", "heldByUser"})
    List<CodCollection> findAllByIdIn(List<UUID> ids);
}
