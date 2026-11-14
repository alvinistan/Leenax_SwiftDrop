package lk.swiftdrop.shipping.shipment;

import java.util.EnumSet;
import java.util.Set;

/**
 * Normalized shipment statuses, the same for every courier. Each courier's own
 * wording is translated into these (by hand today; by the API mapping later).
 */
public enum TrackingStatus {
    BOOKED,
    LABEL_CREATED,
    PICKED_UP,
    IN_TRANSIT,
    CUSTOMS_CLEARANCE,
    OUT_FOR_DELIVERY,
    DELIVERED,
    EXCEPTION,
    RETURNED,
    CANCELLED;

    /** Finished: no further updates. */
    public boolean isFinal() {
        return this == DELIVERED || this == RETURNED || this == CANCELLED;
    }

    /**
     * Which statuses may follow this one. The same status may repeat (e.g. a new
     * "in transit" location). A parcel the courier has collected can no longer be
     * cancelled, only returned.
     */
    public Set<TrackingStatus> allowedNext() {
        return switch (this) {
            case BOOKED -> EnumSet.of(BOOKED, LABEL_CREATED, PICKED_UP, EXCEPTION, CANCELLED);
            case LABEL_CREATED -> EnumSet.of(LABEL_CREATED, PICKED_UP, EXCEPTION, CANCELLED);
            case PICKED_UP, IN_TRANSIT, CUSTOMS_CLEARANCE, OUT_FOR_DELIVERY, EXCEPTION ->
                    EnumSet.of(IN_TRANSIT, CUSTOMS_CLEARANCE, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION, RETURNED);
            case DELIVERED, RETURNED, CANCELLED -> EnumSet.noneOf(TrackingStatus.class);
        };
    }

    public boolean canMoveTo(TrackingStatus next) {
        return allowedNext().contains(next);
    }
}
