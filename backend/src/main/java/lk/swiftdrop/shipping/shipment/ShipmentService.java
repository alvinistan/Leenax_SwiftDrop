package lk.swiftdrop.shipping.shipment;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lk.swiftdrop.catalog.product.ProductService;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.common.money.MoneyResponse;
import lk.swiftdrop.common.web.PageResponse;
import lk.swiftdrop.delivery.CodService;
import lk.swiftdrop.identity.Role;
import lk.swiftdrop.identity.User;
import lk.swiftdrop.identity.UserRepository;
import lk.swiftdrop.order.CustomerOrder;
import lk.swiftdrop.order.DispatchCheck;
import lk.swiftdrop.order.DispatchService;
import lk.swiftdrop.order.OrderRepository;
import lk.swiftdrop.order.OrderStatus;
import lk.swiftdrop.store.StoreDefaults;
import lk.swiftdrop.shipping.audit.ShippingAuditService;
import lk.swiftdrop.shipping.audit.ShippingAuditService.Action;
import lk.swiftdrop.shipping.config.Countries;
import lk.swiftdrop.shipping.config.CourierProviderConfig;
import lk.swiftdrop.shipping.config.CourierProviderRepository;
import lk.swiftdrop.shipping.config.CourierServiceConfig;
import lk.swiftdrop.shipping.provider.CourierProviderRegistry;
import lk.swiftdrop.shipping.provider.ProviderCapability;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.AuditView;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.CreateShipmentRequest;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.ExpenseRequest;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.ExpenseResponse;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.ShipmentDetail;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.ShipmentDetailsRequest;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.ShipmentSummary;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.TrackingEventResponse;
import lk.swiftdrop.shipping.shipment.ShipmentDtos.TrackingUpdateRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manual shipments (Shipping Phase E): the admin books on the courier's portal,
 * records the AWB here and enters tracking updates. Nothing is sent to a
 * courier, and no booking is ever claimed that the admin did not make.
 */
@Service
@Transactional(readOnly = true)
public class ShipmentService {

    /** Small allowance for clock differences between the admin's device and the server. */
    static final Duration FUTURE_TOLERANCE = Duration.ofMinutes(5);

    private final ShipmentRepository shipments;
    private final CourierProviderRepository providers;
    private final CourierProviderRegistry registry;
    private final ShippingAuditService audit;
    private final Clock clock;
    private final OrderRepository orders;
    private final CourierExpenseRepository expenses;
    private final DispatchService dispatch;
    private final UserRepository users;
    private final CodService cod;

    @SuppressWarnings("checkstyle:ParameterNumber")
    public ShipmentService(ShipmentRepository shipments, CourierProviderRepository providers,
                           CourierProviderRegistry registry, ShippingAuditService audit, Clock clock,
                           OrderRepository orders, CourierExpenseRepository expenses, DispatchService dispatch,
                           UserRepository users, CodService cod) {
        this.users = users;
        this.cod = cod;
        this.dispatch = dispatch;
        this.orders = orders;
        this.expenses = expenses;
        this.shipments = shipments;
        this.providers = providers;
        this.registry = registry;
        this.audit = audit;
        this.clock = clock;
    }

    public PageResponse<ShipmentSummary> search(String q, TrackingStatus status, UUID providerId, boolean activeOnly,
                                                Pageable pageable) {
        return PageResponse.from(shipments.search(status, providerId, ProductService.likePattern(q), activeOnly,
                pageable), ShipmentSummary::from);
    }

    public ShipmentDetail get(UUID id) {
        return toDetail(find(id));
    }

    @Transactional
    public ShipmentDetail create(CreateShipmentRequest request) {
        CourierProviderConfig provider = providers.findById(request.providerId())
                .orElseThrow(() -> new BadRequestException("Unknown courier."));
        if (!provider.isEnabled()) {
            throw new BadRequestException(provider.getName() + " is turned off. Turn it on in Shipping → Couriers first.");
        }
        if (!registry.capabilities(provider).contains(ProviderCapability.MANUAL_BOOKING)) {
            throw new BadRequestException(provider.getName() + " shipments cannot be recorded by hand.");
        }
        ShipmentDetailsRequest d = request.details();
        boolean staffDelivery = registry.capabilities(provider).contains(ProviderCapability.STAFF_DELIVERY);
        String awb = isBlank(d.awb()) && staffDelivery
                ? "LD-%06d".formatted(shipments.nextOwnDeliveryNumber())
                : requiredAwb(d.awb());
        if (shipments.existsByProviderIdAndAwbIgnoreCase(provider.getId(), awb)) {
            throw new ConflictException("This " + provider.getName() + " tracking number is already recorded.");
        }
        Instant bookedAt = checkedTime(request.bookedAt());
        Shipment shipment = Shipment.bookedManually(provider, awb, ShippingAuditService.currentUser(), bookedAt);
        applyDetails(shipment, provider, d, awb);
        if (request.orderNumber() != null && !request.orderNumber().isBlank()) {
            shipment.linkTo(shippableOrder(request.orderNumber().trim(), d.destinationCountry(),
                    request.shipBeforePaymentReason()));
        }
        if (request.assignedToUserId() != null) {
            if (!staffDelivery) {
                throw new BadRequestException("Only own deliveries are given to a staff member.");
            }
            shipment.assignTo(activeStaff(request.assignedToUserId()), clock.instant());
        }
        shipments.saveAndFlush(shipment);
        audit.record("SHIPMENT", shipment.getId(), Action.CREATE, null, AuditView.of(shipment));
        return toDetail(shipment);
    }

    @Transactional
    public ShipmentDetail updateDetails(UUID id, ShipmentDetailsRequest d) {
        Shipment shipment = find(id);
        String awb = isBlank(d.awb()) ? shipment.getAwb() : normalizeAwb(d.awb());
        if (shipments.existsByProviderIdAndAwbIgnoreCaseAndIdNot(shipment.getProvider().getId(), awb, id)) {
            throw new ConflictException("This " + shipment.getProvider().getName() + " tracking number is already recorded.");
        }
        AuditView before = AuditView.of(shipment);
        applyDetails(shipment, shipment.getProvider(), d, awb);
        if (shipment.getOrder() != null) {
            // A website order's number and country cannot be changed here.
            if (!shipment.getOrder().getAddress().countryCode().equals(d.destinationCountry())) {
                throw new BadRequestException("The destination must stay " + shipment.getOrder().getAddress().countryCode()
                        + " (the order's country).");
            }
            shipment.linkTo(shipment.getOrder());
        }
        AuditView after = AuditView.of(shipment);
        if (!before.equals(after)) {
            audit.record("SHIPMENT", id, Action.UPDATE, before, after);
        }
        return toDetail(shipment);
    }

    @Transactional
    public ShipmentDetail addTrackingUpdate(UUID id, TrackingUpdateRequest r) {
        Shipment shipment = find(id);
        if (!registry.capabilities(shipment.getProvider()).contains(ProviderCapability.MANUAL_TRACKING)) {
            throw new BadRequestException("Tracking for this courier cannot be updated by hand.");
        }
        boolean staffDelivery = isStaffDelivery(shipment);
        String receivedBy = blankToNull(r.receivedBy());
        if (staffDelivery && r.status() == TrackingStatus.DELIVERED && receivedBy == null) {
            throw new BadRequestException("Enter who received the parcel.");
        }
        User cashHolder = null;
        if (staffDelivery && r.status() == TrackingStatus.DELIVERED && CodService.collectsCash(shipment.getOrder())) {
            // Own delivery: the staff member has the cash (or the owner, if nobody was assigned).
            cashHolder = shipment.getAssignedTo() != null ? shipment.getAssignedTo()
                    : users.findByEmail(ShippingAuditService.currentUser())
                    .orElseThrow(() -> new BadRequestException("Assign a staff member before marking it delivered."));
        }
        applyUpdate(shipment, r.status(), checkedTime(r.occurredAt()), blankToNull(r.location()),
                blankToNull(r.note()), r.failureReason(), receivedBy, cashHolder);
        shipments.flush(); // optimistic lock: a parallel update fails instead of being lost
        return toDetail(shipment);
    }

    /** Own delivery: give the parcel to a staff member (or to nobody). */
    @Transactional
    public ShipmentDetail assign(UUID id, UUID userId) {
        Shipment shipment = find(id);
        if (!isStaffDelivery(shipment)) {
            throw new BadRequestException("Only own deliveries are given to a staff member.");
        }
        AuditView before = AuditView.of(shipment);
        shipment.assignTo(userId == null ? null : activeStaff(userId), clock.instant());
        shipments.flush();
        audit.record("SHIPMENT", id, Action.UPDATE, before, AuditView.of(shipment));
        return toDetail(shipment);
    }

    /**
     * One tracking step, with everything that follows from it: the order's
     * status and, for cash on delivery, who now holds the cash. Used by the
     * admin pages and by the delivery staff pages.
     *
     * @param cashHolder own delivery: the staff member who collected the cash; null = the courier
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    @SuppressWarnings("checkstyle:ParameterNumber")
    public void applyUpdate(Shipment shipment, TrackingStatus status, Instant at, String location, String note,
                            FailureReason failureReason, String receivedBy, User cashHolder) {
        if (failureReason == FailureReason.OTHER && note == null) {
            throw new BadRequestException("Describe what happened in the note.");
        }
        shipment.track(status, at, location, note, TrackingEvent.Source.MANUAL, ShippingAuditService.currentUser(),
                failureReason, receivedBy);
        syncOrder(shipment, status);
        if (status == TrackingStatus.DELIVERED && shipment.getOrder() != null) {
            cod.recordDelivery(shipment, isStaffDelivery(shipment) ? cashHolder : null, at);
        }
    }

    public boolean isStaffDelivery(Shipment shipment) {
        return registry.capabilities(shipment.getProvider()).contains(ProviderCapability.STAFF_DELIVERY);
    }

    /** An enabled user with the DELIVERY role. */
    private User activeStaff(UUID userId) {
        User staff = users.findById(userId)
                .orElseThrow(() -> new BadRequestException("That staff member was not found."));
        if (!staff.hasRole(Role.DELIVERY) || !staff.isEnabled()) {
            throw new BadRequestException(staff.getDisplayName() + " is not an active delivery staff member.");
        }
        return staff;
    }

    /** An extra courier charge (surcharge, return fee, adjustment). Never edited afterwards. */
    @Transactional
    public ShipmentDetail addExpense(UUID id, ExpenseRequest r) {
        Shipment shipment = find(id);
        if (r.amount().signum() == 0) {
            throw new BadRequestException("The amount cannot be 0.");
        }
        if (r.amount().signum() < 0 && r.kind() != CourierExpense.Kind.ADJUSTMENT) {
            throw new BadRequestException("Only an adjustment can be negative (e.g. a refund from the courier).");
        }
        LocalDate today = LocalDate.now(clock.withZone(StoreDefaults.ZONE));
        LocalDate incurredOn = r.incurredOn() != null ? r.incurredOn() : today;
        if (incurredOn.isAfter(today)) {
            throw new BadRequestException("The date cannot be in the future.");
        }
        CourierExpense expense = expenses.save(new CourierExpense(shipment, r.kind(),
                r.amount().setScale(2, java.math.RoundingMode.UNNECESSARY), blankToNull(r.reference()), incurredOn,
                blankToNull(r.note()), ShippingAuditService.currentUser()));
        audit.record("COURIER_EXPENSE", expense.getId(), Action.CREATE, null, ExpenseResponse.from(expense));
        return toDetail(shipment);
    }

    // ------------------------------------------------------------------

    /**
     * Only CONFIRMED (or already SHIPPED, for a second parcel) orders can be
     * shipped: nothing is booked just because an order was placed.
     */
    private CustomerOrder shippableOrder(String orderNumber, String destinationCountry, String overrideReason) {
        CustomerOrder order = orders.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new BadRequestException("Order " + orderNumber + " was not found."));
        if (order.getStatus() != OrderStatus.CONFIRMED && order.getStatus() != OrderStatus.SHIPPED) {
            throw new BadRequestException("Order " + orderNumber + " is " + order.getStatus().name().toLowerCase(Locale.ROOT)
                    + ". Confirm it before shipping.");
        }
        DispatchCheck.Result check = dispatch.check(order);
        if (!check.ready()) {
            String reason = overrideReason == null ? "" : overrideReason.trim();
            if (!check.paymentOverridable() || reason.length() < 5) {
                throw new BadRequestException(String.join(" ", check.blockers()));
            }
            // The owner chose to ship before payment: keep the reason in the order history.
            order.addInternalNote("Shipped before payment: " + reason, ShippingAuditService.currentUser());
        }
        if (!order.getAddress().countryCode().equals(destinationCountry)) {
            throw new BadRequestException("The destination must be " + order.getAddress().countryCode()
                    + " (the order's country).");
        }
        return order;
    }

    /** Collected → the order is SHIPPED; delivered → DELIVERED. Returns are left to the owner. */
    private static void syncOrder(Shipment shipment, TrackingStatus status) {
        CustomerOrder order = shipment.getOrder();
        if (order == null) {
            return;
        }
        String actor = ShippingAuditService.currentUser();
        boolean collected = EnumSet.of(TrackingStatus.PICKED_UP, TrackingStatus.IN_TRANSIT,
                TrackingStatus.CUSTOMS_CLEARANCE, TrackingStatus.OUT_FOR_DELIVERY, TrackingStatus.DELIVERED)
                .contains(status);
        if (collected && order.getStatus() == OrderStatus.CONFIRMED) {
            order.changeStatus(OrderStatus.SHIPPED, "Handed to " + shipment.getProvider().getName()
                    + ", tracking number " + shipment.getAwb(), actor);
        }
        if (status == TrackingStatus.DELIVERED && order.getStatus() == OrderStatus.SHIPPED) {
            order.changeStatus(OrderStatus.DELIVERED, "Delivered (tracking number " + shipment.getAwb() + ")", actor);
        }
    }

    private Shipment find(UUID id) {
        return shipments.findWithEventsById(id).orElseThrow(() -> new ResourceNotFoundException("Shipment", id));
    }

    private void applyDetails(Shipment shipment, CourierProviderConfig provider, ShipmentDetailsRequest d, String awb) {
        if (!Countries.isValid(d.destinationCountry())) {
            throw new BadRequestException("Unknown country code: " + d.destinationCountry());
        }
        CourierServiceConfig service = null;
        if (d.serviceId() != null) {
            // Only a service of THIS courier (no mixing couriers by id).
            service = provider.getServices().stream()
                    .filter(s -> s.getId().equals(d.serviceId()))
                    .findFirst()
                    .orElseThrow(() -> new BadRequestException("That service does not belong to " + provider.getName() + "."));
        }
        shipment.updateDetails(service, d.orderReference().trim(), awb, d.destinationCountry(),
                blankToNull(d.destinationCity()), d.weightKg(), d.courierCost());
    }

    private Instant checkedTime(Instant requested) {
        Instant now = clock.instant();
        if (requested == null) {
            return now;
        }
        if (requested.isAfter(now.plus(FUTURE_TOLERANCE))) {
            throw new BadRequestException("The time cannot be in the future.");
        }
        return requested;
    }

    private ShipmentDetail toDetail(Shipment s) {
        List<CourierExpense> extras = s.getId() == null ? List.of()
                : expenses.findAllByShipmentIdOrderByIncurredOnAscCreatedAtAsc(s.getId());
        BigDecimal total = extras.stream().map(CourierExpense::getAmount)
                .reduce(s.getCourierCost() == null ? BigDecimal.ZERO : s.getCourierCost(), BigDecimal::add);
        Set<ProviderCapability> capabilities = registry.capabilities(s.getProvider());
        boolean manualTracking = capabilities.contains(ProviderCapability.MANUAL_TRACKING);
        Set<TrackingStatus> next = manualTracking && !s.getStatus().isFinal()
                ? s.getStatus().allowedNext() : EnumSet.noneOf(TrackingStatus.class);
        return new ShipmentDetail(s.getId(), s.getProvider().getId(), s.getProvider().getCode(),
                s.getProvider().getName(), s.getService() == null ? null : s.getService().getId(),
                s.getService() == null ? null : s.getService().getName(), s.getOrderReference(), s.getAwb(),
                s.getDestinationCountry(), s.getDestinationCity(), s.getWeightKg(),
                s.getCourierCost() == null ? null : MoneyResponse.of(s.getCourierCost(), s.getCurrency()),
                s.getStatus(), s.getBookingMethod(), s.getProvider().trackingUrl(s.getAwb()), next, manualTracking,
                s.getEvents().stream().map(TrackingEventResponse::from).toList(), s.getCreatedBy(), s.getCreatedAt(),
                s.getOrder() == null ? null : s.getOrder().getOrderNumber(),
                s.getOrder() == null ? null : MoneyResponse.of(s.getOrder().getShippingPrice(), "LKR"),
                extras.stream().map(ExpenseResponse::from).toList(),
                MoneyResponse.of(total, s.getCurrency()),
                capabilities.contains(ProviderCapability.STAFF_DELIVERY),
                s.getAssignedTo() == null ? null
                        : new ShipmentDtos.StaffRef(s.getAssignedTo().getId(), s.getAssignedTo().getDisplayName()),
                s.failedAttempts(),
                CodService.collectsCash(s.getOrder()) && !s.getStatus().isFinal()
                        ? MoneyResponse.of(s.getOrder().getGrandTotal(), "LKR") : null);
    }

    private static String requiredAwb(String awb) {
        if (isBlank(awb)) {
            throw new BadRequestException("Tracking number (AWB) is required.");
        }
        return normalizeAwb(awb);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /** AWBs are compared without case and stored in capitals: "abc-123" and "ABC-123" are the same parcel. */
    private static String normalizeAwb(String awb) {
        return awb.trim().toUpperCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
