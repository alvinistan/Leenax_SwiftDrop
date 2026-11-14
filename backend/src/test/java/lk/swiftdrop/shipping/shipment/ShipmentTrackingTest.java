package lk.swiftdrop.shipping.shipment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import lk.swiftdrop.common.error.BadRequestException;
import org.junit.jupiter.api.Test;

/** The tracking rules, without a database. */
class ShipmentTrackingTest {

    private static final Instant T0 = Instant.parse("2026-11-14T08:00:00Z");

    private static Shipment booked() {
        return Shipment.bookedManually(null, "DEX123", "owner@example.com", T0);
    }

    private static void track(Shipment s, TrackingStatus status, int minutesAfterT0) {
        s.track(status, T0.plusSeconds(60L * minutesAfterT0), null, null, TrackingEvent.Source.MANUAL, "owner");
    }

    @Test
    void aNormalDeliveryGoesStepByStep() {
        Shipment s = booked();
        track(s, TrackingStatus.PICKED_UP, 60);
        track(s, TrackingStatus.IN_TRANSIT, 120);
        track(s, TrackingStatus.IN_TRANSIT, 180); // a new location: the same status may repeat
        track(s, TrackingStatus.OUT_FOR_DELIVERY, 240);
        track(s, TrackingStatus.DELIVERED, 300);

        assertThat(s.getStatus()).isEqualTo(TrackingStatus.DELIVERED);
        assertThat(s.getEvents()).extracting(TrackingEvent::getStatus).containsExactly(
                TrackingStatus.BOOKED, TrackingStatus.PICKED_UP, TrackingStatus.IN_TRANSIT, TrackingStatus.IN_TRANSIT,
                TrackingStatus.OUT_FOR_DELIVERY, TrackingStatus.DELIVERED);
    }

    @Test
    void aDeliveredShipmentTakesNoMoreUpdates() {
        Shipment s = booked();
        track(s, TrackingStatus.PICKED_UP, 1);
        track(s, TrackingStatus.DELIVERED, 2);

        assertThatThrownBy(() -> track(s, TrackingStatus.IN_TRANSIT, 3))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("delivered");
    }

    @Test
    void aCollectedParcelCannotBeCancelledOnlyReturned() {
        Shipment s = booked();
        track(s, TrackingStatus.PICKED_UP, 1);

        assertThatThrownBy(() -> track(s, TrackingStatus.CANCELLED, 2))
                .hasMessage("A shipment that is picked up cannot become cancelled.");
        track(s, TrackingStatus.RETURNED, 2);
        assertThat(s.getStatus()).isEqualTo(TrackingStatus.RETURNED);
    }

    @Test
    void aBookingCanBeCancelledBeforePickUp() {
        Shipment s = booked();
        track(s, TrackingStatus.CANCELLED, 5);
        assertThat(s.getStatus().isFinal()).isTrue();
    }

    @Test
    void updatesMustBeInTimeOrder() {
        Shipment s = booked();
        track(s, TrackingStatus.PICKED_UP, 60);

        assertThatThrownBy(() -> track(s, TrackingStatus.IN_TRANSIT, 30))
                .hasMessageContaining("time order");
        assertThat(s.getStatus()).isEqualTo(TrackingStatus.PICKED_UP);
    }

    @Test
    void anExceptionCanRecover() {
        Shipment s = booked();
        track(s, TrackingStatus.PICKED_UP, 1);
        track(s, TrackingStatus.EXCEPTION, 2); // e.g. address problem
        track(s, TrackingStatus.OUT_FOR_DELIVERY, 3);
        track(s, TrackingStatus.DELIVERED, 4);
        assertThat(s.getStatus()).isEqualTo(TrackingStatus.DELIVERED);
    }

    @Test
    void finalStatusesAllowNothing() {
        for (TrackingStatus status : TrackingStatus.values()) {
            assertThat(status.allowedNext().isEmpty()).isEqualTo(status.isFinal());
            assertThat(status.allowedNext()).doesNotContain(TrackingStatus.BOOKED == status ? null : TrackingStatus.BOOKED);
        }
    }
}
