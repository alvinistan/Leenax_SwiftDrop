package lk.swiftdrop.shipping.pricing;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarkupRuleRepository extends JpaRepository<MarkupRule, UUID> {

    List<MarkupRule> findAllByOrderByCreatedAtAsc();

    List<MarkupRule> findAllByEnabledTrue();
}
