package lk.swiftdrop.shipping.shipment;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class ShippingReportServiceTest {

    @Test
    void everyPeriodInTheRangeIsListedEvenWhenEmpty() {
        assertThat(ShippingReportService.periods(LocalDate.of(2026, 10, 30), LocalDate.of(2026, 11, 2),
                ShippingReportService.Grouping.DAY))
                .containsExactly("2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02");
        assertThat(ShippingReportService.periods(LocalDate.of(2026, 11, 20), LocalDate.of(2027, 1, 5),
                ShippingReportService.Grouping.MONTH))
                .containsExactly("2026-11", "2026-12", "2027-01");
    }

    @Test
    void deliveryTimeIsFromBookingToDelivery() {
        Instant booked = Instant.parse("2026-11-10T08:00:00Z");
        Shipment s = Shipment.bookedManually(null, "DEX1", "owner", booked);
        assertThat(ShippingReportService.timeToDeliver(s)).isEmpty();
        s.track(TrackingStatus.PICKED_UP, booked.plus(Duration.ofHours(6)), null, null, TrackingEvent.Source.MANUAL, "o");
        s.track(TrackingStatus.DELIVERED, booked.plus(Duration.ofHours(36)), null, null, TrackingEvent.Source.MANUAL, "o");
        assertThat(ShippingReportService.timeToDeliver(s)).contains(Duration.ofHours(36));
    }
}
