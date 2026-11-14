package lk.swiftdrop.shipping.shipment;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.shipping.config.CourierProviderConfig;
import lk.swiftdrop.shipping.config.CourierServiceConfig;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * A parcel handed to a courier. Booked MANUALLY on the courier's portal for
 * now; the AWB (air waybill / tracking number) is recorded here. Holds no
 * customer name, phone or address.
 */
@Entity
@Table(name = "shipments")
public class Shipment {

    public enum BookingMethod { MANUAL, API }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_id", nullable = false, updatable = false)
    private CourierProviderConfig provider;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private CourierServiceConfig service;

    /** The owner's order number (text until orders exist in master Phase 8). */
    @Column(name = "order_reference", nullable = false, length = 60)
    private String orderReference;

    @Column(nullable = false, length = 40)
    private String awb;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "destination_country", nullable = false, length = 2)
    private String destinationCountry;

    @Column(name = "destination_city", length = 100)
    private String destinationCity;

    @Column(name = "weight_kg", precision = 12, scale = 3)
    private BigDecimal weightKg;

    /** What the courier charged (manual entry). */
    @Column(name = "courier_cost", precision = 19, scale = 4)
    private BigDecimal courierCost;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(nullable = false, length = 3)
    private String currency = "LKR";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TrackingStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "booking_method", nullable = false, length = 10, updatable = false)
    private BookingMethod bookingMethod;

    @Column(name = "created_by", nullable = false, updatable = false)
    private String createdBy;

    @OneToMany(mappedBy = "shipment", cascade = CascadeType.ALL)
    @OrderBy("occurredAt ASC, createdAt ASC")
    private List<TrackingEvent> events = new ArrayList<>();

    @Version
    private long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Shipment() {
    }

    /** A shipment booked on the courier's portal; starts as BOOKED. */
    public static Shipment bookedManually(CourierProviderConfig provider, String awb, String createdBy,
                                          Instant bookedAt) {
        Shipment shipment = new Shipment();
        shipment.provider = provider;
        shipment.awb = awb;
        shipment.bookingMethod = BookingMethod.MANUAL;
        shipment.createdBy = createdBy;
        shipment.status = TrackingStatus.BOOKED;
        shipment.events.add(new TrackingEvent(shipment, TrackingStatus.BOOKED, bookedAt, null,
                "Booked on the courier's portal", TrackingEvent.Source.MANUAL, createdBy));
        return shipment;
    }

    public void updateDetails(CourierServiceConfig service, String orderReference, String awb,
                              String destinationCountry, String destinationCity, BigDecimal weightKg,
                              BigDecimal courierCost) {
        this.service = service;
        this.orderReference = orderReference;
        this.awb = awb;
        this.destinationCountry = destinationCountry;
        this.destinationCity = destinationCity;
        this.weightKg = weightKg;
        this.courierCost = courierCost;
    }

    /**
     * Records a tracking update. Updates must follow the allowed status steps
     * and be in time order, so the current status is always the latest update.
     */
    public TrackingEvent track(TrackingStatus next, Instant occurredAt, String location, String note,
                               TrackingEvent.Source source, String recordedBy) {
        if (status.isFinal()) {
            throw new BadRequestException("This shipment is " + label(status) + ": no more updates can be added.");
        }
        if (!status.canMoveTo(next)) {
            throw new BadRequestException("A shipment that is " + label(status) + " cannot become " + label(next) + ".");
        }
        Instant latest = events.isEmpty() ? null : events.get(events.size() - 1).getOccurredAt();
        if (latest != null && occurredAt.isBefore(latest)) {
            throw new BadRequestException("Updates must be in time order: this one is earlier than the latest update.");
        }
        TrackingEvent event = new TrackingEvent(this, next, occurredAt, location, note, source, recordedBy);
        events.add(event);
        status = next;
        return event;
    }

    private static String label(TrackingStatus status) {
        return status.name().toLowerCase(java.util.Locale.ROOT).replace('_', ' ');
    }

    public UUID getId() {
        return id;
    }

    public CourierProviderConfig getProvider() {
        return provider;
    }

    public CourierServiceConfig getService() {
        return service;
    }

    public String getOrderReference() {
        return orderReference;
    }

    public String getAwb() {
        return awb;
    }

    public String getDestinationCountry() {
        return destinationCountry;
    }

    public String getDestinationCity() {
        return destinationCity;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public BigDecimal getCourierCost() {
        return courierCost;
    }

    public String getCurrency() {
        return currency;
    }

    public TrackingStatus getStatus() {
        return status;
    }

    public BookingMethod getBookingMethod() {
        return bookingMethod;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public List<TrackingEvent> getEvents() {
        return List.copyOf(events);
    }
}
