package lk.swiftdrop.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

/** One line of an order's history (status changes and payment notes). Never changed. */
@Entity
@Table(name = "order_status_events")
public class OrderStatusEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, updatable = false)
    private CustomerOrder order;

    @Column(nullable = false, length = 20, updatable = false)
    private String status;

    @Column(length = 300, updatable = false)
    private String note;

    @Column(nullable = false, updatable = false)
    private String actor;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected OrderStatusEvent() {
    }

    OrderStatusEvent(CustomerOrder order, String status, String note, String actor) {
        this.order = order;
        this.status = status;
        this.note = note;
        this.actor = actor;
    }

    public String getStatus() {
        return status;
    }

    public String getNote() {
        return note;
    }

    public String getActor() {
        return actor;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
