package lk.swiftdrop.shipping.audit;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Records every shipping configuration change. It joins the caller's
 * transaction (MANDATORY): if the change is rolled back, so is its audit row,
 * so the history never shows changes that didn't happen.
 *
 * <p>Only configuration values are recorded, never secrets or customer data.
 */
@Service
public class ShippingAuditService {

    public enum Action { CREATE, UPDATE, DELETE }

    private final ShippingAuditLogRepository logs;
    private final ObjectMapper json;

    public ShippingAuditService(ShippingAuditLogRepository logs, ObjectMapper json) {
        this.logs = logs;
        this.json = json;
    }

    /** @param before / after the values as API response records (null for CREATE / DELETE) */
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String entityType, Object entityId, Action action, Object before, Object after) {
        logs.save(new ShippingAuditLog(
                entityType, String.valueOf(entityId), action.name(), currentUser(),
                before == null ? null : json.writeValueAsString(before),
                after == null ? null : json.writeValueAsString(after)));
    }

    /** The logged-in admin's email, or "system". */
    public static String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }
}
