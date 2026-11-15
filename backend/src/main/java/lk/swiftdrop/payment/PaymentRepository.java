package lk.swiftdrop.payment;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    List<Payment> findAllByOrderIdOrderByCreatedAtAsc(UUID orderId);

    Optional<Payment> findFirstByOrderIdOrderByCreatedAtDesc(UUID orderId);

    boolean existsByOrderIdAndStatusIn(UUID orderId, java.util.Collection<Payment.Status> statuses);
}
