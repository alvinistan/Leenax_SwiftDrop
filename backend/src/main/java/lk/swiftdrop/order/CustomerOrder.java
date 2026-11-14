package lk.swiftdrop.order;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.common.error.BadRequestException;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * A customer's order ("Order" is a reserved word in SQL, hence the class name).
 * Prices, tax, delivery and address are SNAPSHOTS taken when it was placed.
 */
@Entity
@Table(name = "orders")
public class CustomerOrder {

    public enum PaymentStatus { UNPAID, PAID }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_number", nullable = false, unique = true, length = 20, updatable = false)
    private String orderNumber;

    @Column(name = "customer_id", nullable = false, updatable = false)
    private UUID customerId;

    @Column(name = "idempotency_key", nullable = false, length = 64, updatable = false)
    private String idempotencyKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 20, updatable = false)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 10)
    private PaymentStatus paymentStatus;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(nullable = false, length = 3, updatable = false)
    private String currency;

    @Column(name = "items_total", nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal itemsTotal;

    @Column(name = "tax_included", nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal taxIncluded;

    @Column(name = "shipping_price", nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal shippingPrice;

    @Column(name = "grand_total", nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal grandTotal;

    @Embedded
    private ShippingSnapshot shipping;

    @Embedded
    private DeliveryAddress address;

    @Column(name = "customer_note", length = 500, updatable = false)
    private String customerNote;

    @ElementCollection
    @CollectionTable(name = "order_items", joinColumns = @JoinColumn(name = "order_id"))
    @OrderColumn(name = "position")
    private List<OrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    @OrderBy("createdAt ASC")
    private List<OrderStatusEvent> events = new ArrayList<>();

    @Version
    private long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CustomerOrder() {
    }

    @SuppressWarnings("checkstyle:ParameterNumber")
    public static CustomerOrder place(String orderNumber, UUID customerId, String idempotencyKey,
                                      PaymentMethod paymentMethod, String currency, List<OrderItem> items,
                                      ShippingSnapshot shipping, BigDecimal shippingPrice, DeliveryAddress address,
                                      String customerNote, String actor) {
        CustomerOrder order = new CustomerOrder();
        order.orderNumber = orderNumber;
        order.customerId = customerId;
        order.idempotencyKey = idempotencyKey;
        order.status = OrderStatus.PLACED;
        order.paymentMethod = paymentMethod;
        order.paymentStatus = PaymentStatus.UNPAID;
        order.currency = currency;
        order.items.addAll(items);
        order.itemsTotal = items.stream().map(OrderItem::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        order.taxIncluded = items.stream().map(OrderItem::taxIncluded).reduce(BigDecimal.ZERO, BigDecimal::add);
        order.shipping = shipping;
        order.shippingPrice = shippingPrice;
        order.grandTotal = order.itemsTotal.add(shippingPrice);
        order.address = address;
        order.customerNote = customerNote;
        order.events.add(new OrderStatusEvent(order, OrderStatus.PLACED.name(), "Order placed", actor));
        return order;
    }

    /** Moves the order on; only the allowed steps (see OrderStatus.allowedNext). */
    public void changeStatus(OrderStatus next, String note, String actor) {
        if (!status.allowedNext().contains(next)) {
            throw new BadRequestException("An order that is " + status.name().toLowerCase()
                    + " cannot become " + next.name().toLowerCase() + ".");
        }
        status = next;
        events.add(new OrderStatusEvent(this, next.name(), note, actor));
    }

    public void markPaid(String note, String actor) {
        if (status == OrderStatus.CANCELLED) {
            throw new BadRequestException("A cancelled order cannot be marked as paid.");
        }
        if (paymentStatus == PaymentStatus.PAID) {
            throw new BadRequestException("This order is already marked as paid.");
        }
        paymentStatus = PaymentStatus.PAID;
        events.add(new OrderStatusEvent(this, "PAID", note == null ? "Payment received" : note, actor));
    }

    public UUID getId() {
        return id;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public UUID getCustomerId() {
        return customerId;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public PaymentStatus getPaymentStatus() {
        return paymentStatus;
    }

    public String getCurrency() {
        return currency;
    }

    public BigDecimal getItemsTotal() {
        return itemsTotal;
    }

    public BigDecimal getTaxIncluded() {
        return taxIncluded;
    }

    public BigDecimal getShippingPrice() {
        return shippingPrice;
    }

    public BigDecimal getGrandTotal() {
        return grandTotal;
    }

    public ShippingSnapshot getShipping() {
        return shipping;
    }

    public DeliveryAddress getAddress() {
        return address;
    }

    public String getCustomerNote() {
        return customerNote;
    }

    public List<OrderItem> getItems() {
        return List.copyOf(items);
    }

    public List<OrderStatusEvent> getEvents() {
        return List.copyOf(events);
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
