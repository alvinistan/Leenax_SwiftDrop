package lk.swiftdrop.shipping.audit;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShippingAuditLogRepository extends JpaRepository<ShippingAuditLog, UUID> {

    Page<ShippingAuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<ShippingAuditLog> findAllByEntityTypeOrderByCreatedAtDesc(String entityType, Pageable pageable);
}
