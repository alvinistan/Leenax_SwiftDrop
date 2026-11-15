package lk.swiftdrop.delivery;

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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.identity.User;
import lk.swiftdrop.order.CustomerOrder;
import lk.swiftdrop.shipping.config.CourierProviderConfig;
import lk.swiftdrop.shipping.shipment.Shipment;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Cash a customer paid on delivery, from the moment it was collected (HELD by
 * the courier or a staff member) until it reaches the owner (SETTLED). Only
 * then is the order marked paid (owner decision, 2026-11-15).
 */
@Entity
@Table(name = "cod_collections")
public class CodCollection {

    public enum HolderType { COURIER, STAFF }

    public enum Status { HELD, SETTLED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, updatable = false)
    private CustomerOrder order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shipment_id", nullable = false, updatable = false)
    private Shipment shipment;

    @Column(nullable = false, precision = 19, scale = 4, updatable = false)
    private BigDecimal amount;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(nullable = false, length = 3, updatable = false)
    private String currency = "LKR";

    @Enumerated(EnumType.STRING)
    @Column(name = "held_by_type", nullable = false, length = 10, updatable = false)
    private HolderType holderType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "held_by_provider_id", updatable = false)
    private CourierProviderConfig heldByProvider;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "held_by_user_id", updatable = false)
    private User heldByUser;

    @Column(name = "collected_at", nullable = false, updatable = false)
    private Instant collectedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status;

    @Column(name = "settled_at")
    private Instant settledAt;

    @Column(name = "settled_by", length = 254)
    private String settledBy;

    @Column(name = "settlement_reference", length = 60)
    private String settlementReference;

    @Version
    private long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected CodCollection() {
    }

    static CodCollection heldByCourier(CustomerOrder order, Shipment shipment, Instant collectedAt) {
        CodCollection c = held(order, shipment, collectedAt);
        c.holderType = HolderType.COURIER;
        c.heldByProvider = shipment.getProvider();
        return c;
    }

    static CodCollection heldByStaff(CustomerOrder order, Shipment shipment, User staff, Instant collectedAt) {
        CodCollection c = held(order, shipment, collectedAt);
        c.holderType = HolderType.STAFF;
        c.heldByUser = staff;
        return c;
    }

    private static CodCollection held(CustomerOrder order, Shipment shipment, Instant collectedAt) {
        CodCollection c = new CodCollection();
        c.order = order;
        c.shipment = shipment;
        c.amount = order.getGrandTotal();
        c.collectedAt = collectedAt;
        c.status = Status.HELD;
        return c;
    }

    /** The money reached the owner. */
    void settle(String reference, String actor, Instant at) {
        if (status != Status.HELD) {
            throw new BadRequestException("The cash for order " + order.getOrderNumber() + " was already received.");
        }
        status = Status.SETTLED;
        settlementReference = reference;
        settledBy = actor;
        settledAt = at;
    }

    /** Who has the cash now: the courier's or the staff member's name. */
    public String holderName() {
        return holderType == HolderType.COURIER ? heldByProvider.getName() : heldByUser.getDisplayName();
    }

    public UUID getId() {
        return id;
    }

    public CustomerOrder getOrder() {
        return order;
    }

    public Shipment getShipment() {
        return shipment;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }

    public HolderType getHolderType() {
        return holderType;
    }

    public CourierProviderConfig getHeldByProvider() {
        return heldByProvider;
    }

    public User getHeldByUser() {
        return heldByUser;
    }

    public Instant getCollectedAt() {
        return collectedAt;
    }

    public Status getStatus() {
        return status;
    }

    public Instant getSettledAt() {
        return settledAt;
    }

    public String getSettledBy() {
        return settledBy;
    }

    public String getSettlementReference() {
        return settlementReference;
    }
}
