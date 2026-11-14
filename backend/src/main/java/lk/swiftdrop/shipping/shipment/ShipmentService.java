package lk.swiftdrop.shipping.shipment;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lk.swiftdrop.catalog.product.ProductService;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.common.money.MoneyResponse;
import lk.swiftdrop.common.web.PageResponse;
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

    public ShipmentService(ShipmentRepository shipments, CourierProviderRepository providers,
                           CourierProviderRegistry registry, ShippingAuditService audit, Clock clock) {
        this.shipments = shipments;
        this.providers = providers;
        this.registry = registry;
        this.audit = audit;
        this.clock = clock;
    }

    public PageResponse<ShipmentSummary> search(String q, TrackingStatus status, UUID providerId, Pageable pageable) {
        return PageResponse.from(
                shipments.search(status, providerId, ProductService.likePattern(q), pageable), ShipmentSummary::from);
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
        String awb = normalizeAwb(d.awb());
        if (shipments.existsByProviderIdAndAwbIgnoreCase(provider.getId(), awb)) {
            throw new ConflictException("This " + provider.getName() + " tracking number is already recorded.");
        }
        Instant bookedAt = checkedTime(request.bookedAt());
        Shipment shipment = Shipment.bookedManually(provider, awb, ShippingAuditService.currentUser(), bookedAt);
        applyDetails(shipment, provider, d, awb);
        shipments.saveAndFlush(shipment);
        audit.record("SHIPMENT", shipment.getId(), Action.CREATE, null, AuditView.of(shipment));
        return toDetail(shipment);
    }

    @Transactional
    public ShipmentDetail updateDetails(UUID id, ShipmentDetailsRequest d) {
        Shipment shipment = find(id);
        String awb = normalizeAwb(d.awb());
        if (shipments.existsByProviderIdAndAwbIgnoreCaseAndIdNot(shipment.getProvider().getId(), awb, id)) {
            throw new ConflictException("This " + shipment.getProvider().getName() + " tracking number is already recorded.");
        }
        AuditView before = AuditView.of(shipment);
        applyDetails(shipment, shipment.getProvider(), d, awb);
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
        shipment.track(r.status(), checkedTime(r.occurredAt()), blankToNull(r.location()), blankToNull(r.note()),
                TrackingEvent.Source.MANUAL, ShippingAuditService.currentUser());
        shipments.flush(); // optimistic lock: a parallel update fails instead of being lost
        return toDetail(shipment);
    }

    // ------------------------------------------------------------------

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
                s.getEvents().stream().map(TrackingEventResponse::from).toList(), s.getCreatedBy(), s.getCreatedAt());
    }

    /** AWBs are compared without case and stored in capitals: "abc-123" and "ABC-123" are the same parcel. */
    private static String normalizeAwb(String awb) {
        return awb.trim().toUpperCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
