package lk.swiftdrop.shipping.shipment;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

/** One tracking update. Never changed after it is saved (a correction is a new update). */
@Entity
@Table(name = "shipment_tracking_events")
public class TrackingEvent {

    public enum Source { MANUAL, API }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shipment_id", nullable = false, updatable = false)
    private Shipment shipment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private TrackingStatus status;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    @Column(length = 100, updatable = false)
    private String location;

    @Column(length = 500, updatable = false)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10, updatable = false)
    private Source source;

    @Column(name = "recorded_by", nullable = false, updatable = false)
    private String recordedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected TrackingEvent() {
    }

    TrackingEvent(Shipment shipment, TrackingStatus status, Instant occurredAt, String location, String note,
                  Source source, String recordedBy) {
        this.shipment = shipment;
        this.status = status;
        this.occurredAt = occurredAt;
        this.location = location;
        this.note = note;
        this.source = source;
        this.recordedBy = recordedBy;
    }

    public UUID getId() {
        return id;
    }

    public TrackingStatus getStatus() {
        return status;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public String getLocation() {
        return location;
    }

    public String getNote() {
        return note;
    }

    public Source getSource() {
        return source;
    }

    public String getRecordedBy() {
        return recordedBy;
    }
}
