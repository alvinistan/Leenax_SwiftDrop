package lk.swiftdrop.order;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<CustomerOrder, UUID> {

    Optional<CustomerOrder> findByCustomerIdAndIdempotencyKey(UUID customerId, String idempotencyKey);

    Optional<CustomerOrder> findByOrderNumber(String orderNumber);

    /** Only this customer's order: someone else's order number gives "not found". */
    Optional<CustomerOrder> findByOrderNumberAndCustomerId(String orderNumber, UUID customerId);

    Page<CustomerOrder> findAllByCustomerIdOrderByCreatedAtDesc(UUID customerId, Pageable pageable);

    @Query("""
            SELECT o FROM CustomerOrder o
            WHERE (:status IS NULL OR o.status = :status)
              AND (:pattern IS NULL
                   OR LOWER(o.orderNumber) LIKE :pattern ESCAPE '\\'
                   OR LOWER(o.address.recipientName) LIKE :pattern ESCAPE '\\')
            """)
    Page<CustomerOrder> search(@Param("status") OrderStatus status, @Param("pattern") String pattern,
                               Pageable pageable);

    @Query(value = "SELECT nextval('order_number_seq')", nativeQuery = true)
    long nextOrderNumber();

    /** PLACED orders, and CONFIRMED orders without a parcel yet; oldest first. */
    @Query("""
            SELECT o FROM CustomerOrder o
            WHERE o.status = lk.swiftdrop.order.OrderStatus.PLACED
               OR (o.status = lk.swiftdrop.order.OrderStatus.CONFIRMED
                   AND NOT EXISTS (SELECT s FROM Shipment s WHERE s.order = o))
            ORDER BY o.createdAt ASC
            """)
    java.util.List<CustomerOrder> findOpenForDispatch();
}
