package lk.swiftdrop.payment;

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
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lk.swiftdrop.order.CustomerOrder;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/** One attempt to pay an order online. No card numbers are stored. */
@Entity
@Table(name = "payments")
public class Payment {

    public enum Status { STARTED, PENDING, SUCCEEDED, CANCELLED, FAILED, CHARGED_BACK }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, updatable = false)
    private CustomerOrder order;

    @Column(nullable = false, length = 20, updatable = false)
    private String provider;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal amount;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(nullable = false, length = 3, updatable = false)
    private String currency;

    @Column(name = "provider_payment_id", length = 40)
    private String providerPaymentId;

    @Column(name = "provider_method", length = 20)
    private String providerMethod;

    @Column(name = "provider_status_code")
    private Integer providerStatusCode;

    @Column(name = "provider_message", length = 300)
    private String providerMessage;

    @Version
    private long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Payment() {
    }

    static Payment started(CustomerOrder order, String provider) {
        Payment p = new Payment();
        p.order = order;
        p.provider = provider;
        p.status = Status.STARTED;
        p.amount = order.getGrandTotal();
        p.currency = order.getCurrency();
        return p;
    }

    /** Records what a VERIFIED notification said. */
    void record(Status status, String providerPaymentId, String method, int statusCode, String message) {
        this.status = status;
        this.providerPaymentId = providerPaymentId;
        this.providerMethod = method;
        this.providerStatusCode = statusCode;
        this.providerMessage = message;
    }

    public UUID getId() {
        return id;
    }

    public CustomerOrder getOrder() {
        return order;
    }

    public String getProvider() {
        return provider;
    }

    public Status getStatus() {
        return status;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }

    public String getProviderPaymentId() {
        return providerPaymentId;
    }

    public String getProviderMethod() {
        return providerMethod;
    }

    public String getProviderMessage() {
        return providerMessage;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
