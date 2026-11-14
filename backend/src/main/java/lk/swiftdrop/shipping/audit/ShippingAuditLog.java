package lk.swiftdrop.shipping.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

/** One recorded change to a shipping setting: who, what, before, after, when. Never edited. */
@Entity
@Table(name = "shipping_audit_log")
public class ShippingAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "entity_type", nullable = false, length = 40, updatable = false)
    private String entityType;

    @Column(name = "entity_id", nullable = false, length = 60, updatable = false)
    private String entityId;

    @Column(nullable = false, length = 10, updatable = false)
    private String action;

    @Column(nullable = false, length = 254, updatable = false)
    private String actor;

    @Column(name = "before_json", columnDefinition = "text", updatable = false)
    private String beforeJson;

    @Column(name = "after_json", columnDefinition = "text", updatable = false)
    private String afterJson;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ShippingAuditLog() {
    }

    ShippingAuditLog(String entityType, String entityId, String action, String actor, String beforeJson, String afterJson) {
        this.entityType = entityType;
        this.entityId = entityId;
        this.action = action;
        this.actor = actor;
        this.beforeJson = beforeJson;
        this.afterJson = afterJson;
    }

    public UUID getId() {
        return id;
    }

    public String getEntityType() {
        return entityType;
    }

    public String getEntityId() {
        return entityId;
    }

    public String getAction() {
        return action;
    }

    public String getActor() {
        return actor;
    }

    public String getBeforeJson() {
        return beforeJson;
    }

    public String getAfterJson() {
        return afterJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
