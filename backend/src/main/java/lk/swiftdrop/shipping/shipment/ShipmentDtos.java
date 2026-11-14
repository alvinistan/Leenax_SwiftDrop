package lk.swiftdrop.shipping.shipment;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lk.swiftdrop.common.money.MoneyResponse;

/** Shipment shapes for the admin API. No customer personal data. */
public final class ShipmentDtos {

    private ShipmentDtos() {
    }

    private static final String AWB = "^[A-Za-z0-9-]{4,40}$";
    private static final String AWB_MESSAGE = "Enter the tracking number (AWB): 4 to 40 letters, digits or hyphens.";

    /** Details that can be corrected later. */
    public record ShipmentDetailsRequest(
            UUID serviceId,
            @NotBlank(message = "Order reference is required.") @Size(max = 60) String orderReference,
            @NotBlank(message = "Tracking number (AWB) is required.") @Pattern(regexp = AWB, message = AWB_MESSAGE) String awb,
            @NotNull(message = "Choose the destination country.")
            @Pattern(regexp = "^[A-Z]{2}$", message = "Use a two-letter country code.") String destinationCountry,
            @Size(max = 100) String destinationCity,
            @DecimalMin(value = "0.001", message = "Weight must be more than 0.")
            @Digits(integer = 9, fraction = 3, message = "At most 3 decimal places.") BigDecimal weightKg,
            @DecimalMin(value = "0", message = "Cost cannot be negative.")
            @Digits(integer = 13, fraction = 2, message = "At most 2 decimal places.") BigDecimal courierCost) {
    }

    /** Recording a parcel already booked on the courier's portal. */
    public record CreateShipmentRequest(
            @NotNull(message = "Choose the courier.") UUID providerId,
            @NotNull @jakarta.validation.Valid ShipmentDetailsRequest details,
            /** When it was booked on the portal; empty = now. */
            Instant bookedAt) {
    }

    public record TrackingUpdateRequest(
            @NotNull(message = "Choose the new status.") TrackingStatus status,
            /** When it happened (from the courier's site); empty = now. */
            Instant occurredAt,
            @Size(max = 100) String location,
            @Size(max = 500) String note) {
    }

    public record ShipmentSummary(UUID id, String orderReference, String awb, String providerCode,
                                  String providerName, String destinationCountry, String destinationCity,
                                  TrackingStatus status, Instant createdAt, Instant updatedAt) {

        static ShipmentSummary from(Shipment s) {
            return new ShipmentSummary(s.getId(), s.getOrderReference(), s.getAwb(), s.getProvider().getCode(),
                    s.getProvider().getName(), s.getDestinationCountry(), s.getDestinationCity(), s.getStatus(),
                    s.getCreatedAt(), s.getUpdatedAt());
        }
    }

    public record TrackingEventResponse(UUID id, TrackingStatus status, Instant occurredAt, String location,
                                        String note, TrackingEvent.Source source, String recordedBy) {

        static TrackingEventResponse from(TrackingEvent e) {
            return new TrackingEventResponse(e.getId(), e.getStatus(), e.getOccurredAt(), e.getLocation(),
                    e.getNote(), e.getSource(), e.getRecordedBy());
        }
    }

    public record ShipmentDetail(UUID id, UUID providerId, String providerCode, String providerName,
                                 UUID serviceId, String serviceName, String orderReference, String awb,
                                 String destinationCountry, String destinationCity, BigDecimal weightKg,
                                 MoneyResponse courierCost, TrackingStatus status,
                                 Shipment.BookingMethod bookingMethod, String trackingUrl,
                                 Set<TrackingStatus> allowedNextStatuses, boolean manualTracking,
                                 List<TrackingEventResponse> events, String createdBy, Instant createdAt) {
    }

    /** What the change history stores (no events: they are their own history). */
    record AuditView(String orderReference, String awb, String provider, String service, String destinationCountry,
                     String destinationCity, BigDecimal weightKg, BigDecimal courierCost, TrackingStatus status) {

        static AuditView of(Shipment s) {
            return new AuditView(s.getOrderReference(), s.getAwb(), s.getProvider().getCode(),
                    s.getService() == null ? null : s.getService().getCode(), s.getDestinationCountry(),
                    s.getDestinationCity(), s.getWeightKg(), s.getCourierCost(), s.getStatus());
        }
    }
}
