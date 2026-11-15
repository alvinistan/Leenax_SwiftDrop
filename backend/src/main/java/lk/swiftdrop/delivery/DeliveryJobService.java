package lk.swiftdrop.delivery;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.catalog.product.SaleUnit;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.common.money.MoneyResponse;
import lk.swiftdrop.identity.Role;
import lk.swiftdrop.identity.User;
import lk.swiftdrop.identity.UserRepository;
import lk.swiftdrop.order.CustomerOrder;
import lk.swiftdrop.order.DeliveryAddress;
import lk.swiftdrop.shipping.shipment.FailureReason;
import lk.swiftdrop.shipping.shipment.Shipment;
import lk.swiftdrop.shipping.shipment.ShipmentRepository;
import lk.swiftdrop.shipping.shipment.ShipmentService;
import lk.swiftdrop.shipping.shipment.TrackingStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The delivery staff pages. A staff member sees ONLY the parcels assigned to
 * them that are still to be delivered: the customer's address and phone
 * disappear from their view once the parcel is delivered, returned or
 * reassigned.
 */
@Service
@Transactional(readOnly = true)
public class DeliveryJobService {

    private final UserRepository users;
    private final ShipmentRepository shipments;
    private final ShipmentService shipmentService;
    private final Clock clock;

    public DeliveryJobService(UserRepository users, ShipmentRepository shipments, ShipmentService shipmentService,
                              Clock clock) {
        this.users = users;
        this.shipments = shipments;
        this.shipmentService = shipmentService;
        this.clock = clock;
    }

    public enum Action { START, DELIVERED, FAILED }

    public record JobUpdateRequest(
            @NotNull(message = "Choose what happened.") Action action,
            /** DELIVERED: who received the parcel. */
            @Size(max = 100) String receivedBy,
            /** DELIVERED, cash on delivery: the staff member confirms the full amount was collected. */
            Boolean cashCollected,
            /** FAILED: why. */
            FailureReason failureReason,
            @Size(max = 500) String note) {
    }

    public record JobItem(String productName, String variantLabel, BigDecimal quantity, SaleUnit saleUnit) {
    }

    public record FailedAttempt(Instant at, String reason, String note) {
    }

    public record JobSummary(UUID id, String reference, String orderNumber, TrackingStatus status,
                             String recipientName, String city, MoneyResponse cashToCollect, long failedAttempts,
                             Instant assignedAt) {
    }

    public record JobDetail(UUID id, String reference, String orderNumber, TrackingStatus status,
                            /** Null for parcels of orders taken outside the website. */
                            String recipientName, String phone, String line1, String line2, String city,
                            String region, String postalCode, String customerNote, List<JobItem> items,
                            MoneyResponse cashToCollect, boolean alreadyPaid, List<FailedAttempt> failedAttempts,
                            boolean canStart, boolean canFinish, Instant assignedAt) {
    }

    public List<JobSummary> myJobs(String email) {
        User me = currentStaff(email);
        return shipments.findActiveAssignedTo(me.getId()).stream().map(DeliveryJobService::summary).toList();
    }

    public JobDetail myJob(String email, UUID id) {
        return detail(ownActive(currentStaff(email), id));
    }

    @Transactional
    public JobDetail update(String email, UUID id, JobUpdateRequest r) {
        User me = currentStaff(email);
        Shipment s = ownActive(me, id);
        Instant now = clock.instant();
        String note = blankToNull(r.note());
        switch (r.action()) {
            case START -> {
                requireNext(s, TrackingStatus.OUT_FOR_DELIVERY, "This delivery has already started.");
                shipmentService.applyUpdate(s, TrackingStatus.OUT_FOR_DELIVERY, now, null, note, null, null, null);
            }
            case DELIVERED -> {
                requireOutForDelivery(s);
                String receivedBy = blankToNull(r.receivedBy());
                if (receivedBy == null || receivedBy.length() < 2) {
                    throw new BadRequestException("Enter the name of the person who received the parcel.");
                }
                if (CodService.collectsCash(s.getOrder()) && !Boolean.TRUE.equals(r.cashCollected())) {
                    throw new BadRequestException("Confirm that you collected LKR "
                            + MoneyResponse.of(s.getOrder().getGrandTotal(), "LKR").amount()
                            + " in cash. If the customer could not pay, report a failed attempt instead.");
                }
                shipmentService.applyUpdate(s, TrackingStatus.DELIVERED, now, null, note, null, receivedBy, me);
            }
            case FAILED -> {
                requireOutForDelivery(s);
                if (r.failureReason() == null) {
                    throw new BadRequestException("Choose why the parcel could not be delivered.");
                }
                shipmentService.applyUpdate(s, TrackingStatus.EXCEPTION, now, null, note, r.failureReason(), null,
                        null);
            }
            default -> throw new IllegalStateException();
        }
        shipments.flush(); // a parallel update by the owner → 409, nothing lost
        return detail(s);
    }

    // ------------------------------------------------------------------

    /**
     * The logged-in user must still be an enabled DELIVERY account: a session
     * opened before the owner disabled the account is refused here.
     */
    private User currentStaff(String email) {
        return users.findByEmail(email).filter(u -> u.isEnabled() && u.hasRole(Role.DELIVERY))
                .orElseThrow(() -> new AccessDeniedException("Not an active delivery account"));
    }

    /** Someone else's parcel, or a finished one, is "not found" (nothing about it leaks). */
    private Shipment ownActive(User me, UUID id) {
        return shipments.findWithEventsById(id)
                .filter(s -> s.getAssignedTo() != null && s.getAssignedTo().getId().equals(me.getId()))
                .filter(s -> !s.getStatus().isFinal())
                .orElseThrow(() -> new ResourceNotFoundException("Delivery", id));
    }

    private static void requireNext(Shipment s, TrackingStatus next, String message) {
        if (s.getStatus() == next || !s.getStatus().canMoveTo(next)) {
            throw new BadRequestException(message);
        }
    }

    private static void requireOutForDelivery(Shipment s) {
        if (s.getStatus() != TrackingStatus.OUT_FOR_DELIVERY) {
            throw new BadRequestException("Start the delivery first.");
        }
    }

    private static MoneyResponse cash(Shipment s) {
        return CodService.collectsCash(s.getOrder()) ? MoneyResponse.of(s.getOrder().getGrandTotal(), "LKR") : null;
    }

    private static JobSummary summary(Shipment s) {
        DeliveryAddress a = s.getOrder() == null ? null : s.getOrder().getAddress();
        return new JobSummary(s.getId(), s.getAwb(), s.getOrder() == null ? s.getOrderReference()
                : s.getOrder().getOrderNumber(), s.getStatus(), a == null ? null : a.recipientName(),
                a == null ? s.getDestinationCity() : a.city(), cash(s), s.failedAttempts(), s.getAssignedAt());
    }

    private static JobDetail detail(Shipment s) {
        CustomerOrder o = s.getOrder();
        DeliveryAddress a = o == null ? null : o.getAddress();
        List<JobItem> items = o == null ? List.of() : o.getItems().stream()
                .map(i -> new JobItem(i.productName(), i.variantLabel(), i.quantity(), i.saleUnit())).toList();
        List<FailedAttempt> failed = s.getEvents().stream().filter(e -> e.getFailureReason() != null)
                .map(e -> new FailedAttempt(e.getOccurredAt(), e.getFailureReason().label(), e.getNote())).toList();
        boolean out = s.getStatus() == TrackingStatus.OUT_FOR_DELIVERY;
        return new JobDetail(s.getId(), s.getAwb(), o == null ? s.getOrderReference() : o.getOrderNumber(),
                s.getStatus(), a == null ? null : a.recipientName(), a == null ? null : a.phone(),
                a == null ? null : a.line1(), a == null ? null : a.line2(), a == null ? s.getDestinationCity() : a.city(),
                a == null ? null : a.region(), a == null ? null : a.postalCode(), o == null ? null : o.getCustomerNote(),
                items, cash(s), o != null && o.getPaymentStatus() == CustomerOrder.PaymentStatus.PAID, failed,
                !out && s.getStatus().canMoveTo(TrackingStatus.OUT_FOR_DELIVERY), out, s.getAssignedAt());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
