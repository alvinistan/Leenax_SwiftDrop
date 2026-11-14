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
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

/**
 * An extra courier charge after booking (the base charge is on the shipment).
 * Never edited: a mistake is corrected with an ADJUSTMENT (may be negative).
 */
@Entity
@Table(name = "courier_expenses")
public class CourierExpense {

    public enum Kind { SURCHARGE, RETURN, ADJUSTMENT }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shipment_id", nullable = false, updatable = false)
    private Shipment shipment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private Kind kind;

    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal amount;

    @Column(length = 60, updatable = false)
    private String reference;

    @Column(name = "incurred_on", nullable = false, updatable = false)
    private LocalDate incurredOn;

    @Column(length = 300, updatable = false)
    private String note;

    @Column(name = "recorded_by", nullable = false, updatable = false)
    private String recordedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected CourierExpense() {
    }

    public CourierExpense(Shipment shipment, Kind kind, BigDecimal amount, String reference, LocalDate incurredOn,
                          String note, String recordedBy) {
        this.shipment = shipment;
        this.kind = kind;
        this.amount = amount;
        this.reference = reference;
        this.incurredOn = incurredOn;
        this.note = note;
        this.recordedBy = recordedBy;
    }

    public UUID getId() {
        return id;
    }

    public Shipment getShipment() {
        return shipment;
    }

    public Kind getKind() {
        return kind;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getReference() {
        return reference;
    }

    public LocalDate getIncurredOn() {
        return incurredOn;
    }

    public String getNote() {
        return note;
    }

    public String getRecordedBy() {
        return recordedBy;
    }
}
