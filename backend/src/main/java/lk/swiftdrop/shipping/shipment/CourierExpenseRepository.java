package lk.swiftdrop.shipping.shipment;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourierExpenseRepository extends JpaRepository<CourierExpense, UUID> {

    List<CourierExpense> findAllByShipmentIdOrderByIncurredOnAscCreatedAtAsc(UUID shipmentId);

    List<CourierExpense> findAllByShipmentIdIn(Collection<UUID> shipmentIds);

    List<CourierExpense> findAllByIncurredOnBetween(LocalDate from, LocalDate to);
}
