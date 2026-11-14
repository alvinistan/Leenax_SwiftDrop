package lk.swiftdrop.shipping.shipment;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.money.MoneyResponse;
import lk.swiftdrop.store.StoreDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Shipping overview for a period (Sri Lankan dates): totals, a time series and
 * breakdowns, from the shipments recorded in that period. Same money rules as
 * the expenses report: an order's delivery charge counts once; unknown courier
 * costs are reported as missing, never as 0; the margin is GROSS, not profit.
 */
@Service
@Transactional(readOnly = true)
public class ShippingReportService {

    public enum Grouping { DAY, MONTH }

    private static final String CURRENCY = "LKR";
    private static final int MAX_DAYS = 366;

    public record Totals(int shipments, int delivered, int returned, int withoutCourierCost,
                         MoneyResponse deliveryCharged, MoneyResponse courierCosts, MoneyResponse grossMargin,
                         /** per website order; null if none */ MoneyResponse averageDeliveryCharged,
                         /** booked → delivered, in days (1 decimal); null if nothing delivered */ BigDecimal averageDaysToDeliver) {
    }

    /** One bar group: a day ("2026-11-14") or a month ("2026-11"). */
    public record Point(String period, int shipments, MoneyResponse deliveryCharged, MoneyResponse courierCosts,
                        MoneyResponse grossMargin) {
    }

    public record CourierRow(String providerName, int shipments, MoneyResponse courierCosts) {
    }

    public record CountryRow(String countryCode, int shipments) {
    }

    public record StatusRow(TrackingStatus status, int shipments) {
    }

    public record Summary(LocalDate from, LocalDate to, Grouping grouping, Totals totals, List<Point> series,
                          List<CourierRow> byCourier, List<CountryRow> byCountry, List<StatusRow> byStatus) {
    }

    private final ShipmentRepository shipments;
    private final CourierExpenseRepository expenses;

    public ShippingReportService(ShipmentRepository shipments, CourierExpenseRepository expenses) {
        this.shipments = shipments;
        this.expenses = expenses;
    }

    public Summary summary(LocalDate from, LocalDate to, Grouping grouping) {
        if (to.isBefore(from)) {
            throw new BadRequestException("The end date must not be before the start date.");
        }
        if (from.plusDays(MAX_DAYS).isBefore(to)) {
            throw new BadRequestException("Choose a period of at most one year.");
        }
        List<Shipment> list = new ArrayList<>(shipments.findForReport(from.atStartOfDay(StoreDefaults.ZONE).toInstant(),
                to.plusDays(1).atStartOfDay(StoreDefaults.ZONE).toInstant()));
        list.sort(Comparator.comparing(Shipment::getCreatedAt));
        Map<UUID, BigDecimal> extras = list.isEmpty() ? Map.of()
                : expenses.findAllByShipmentIdIn(list.stream().map(Shipment::getId).toList()).stream()
                .collect(Collectors.groupingBy(e -> e.getShipment().getId(),
                        Collectors.reducing(BigDecimal.ZERO, CourierExpense::getAmount, BigDecimal::add)));

        // Every period in the range appears, also empty ones (a gap is information).
        Map<String, Acc> buckets = new LinkedHashMap<>();
        for (String period : periods(from, to, grouping)) {
            buckets.put(period, new Acc());
        }
        Acc all = new Acc();
        Map<String, Acc> byCourier = new TreeMap<>();
        Map<String, Integer> byCountry = new TreeMap<>();
        Map<TrackingStatus, Integer> byStatus = new TreeMap<>();
        Set<UUID> ordersCounted = new HashSet<>();
        int websiteOrders = 0;
        int delivered = 0;
        int returned = 0;
        long deliverySeconds = 0;

        for (Shipment s : list) {
            BigDecimal charged = s.getOrder() != null && ordersCounted.add(s.getOrder().getId())
                    ? s.getOrder().getShippingPrice() : null;
            if (charged != null) {
                websiteOrders++;
            }
            BigDecimal cost = s.getCourierCost() == null ? null
                    : s.getCourierCost().add(extras.getOrDefault(s.getId(), BigDecimal.ZERO));
            String period = period(s.getCreatedAt(), grouping);
            buckets.computeIfAbsent(period, k -> new Acc()).add(charged, cost);
            all.add(charged, cost);
            byCourier.computeIfAbsent(s.getProvider().getName(), k -> new Acc()).add(null, cost);
            byCountry.merge(s.getDestinationCountry(), 1, Integer::sum);
            byStatus.merge(s.getStatus(), 1, Integer::sum);
            if (s.getStatus() == TrackingStatus.RETURNED) {
                returned++;
            }
            Optional<Duration> took = timeToDeliver(s);
            if (took.isPresent()) {
                delivered++;
                deliverySeconds += took.get().toSeconds();
            }
        }

        BigDecimal avgCharged = websiteOrders == 0 ? null
                : all.charged.divide(BigDecimal.valueOf(websiteOrders), 2, RoundingMode.HALF_UP);
        BigDecimal avgDays = delivered == 0 ? null
                : BigDecimal.valueOf(deliverySeconds).divide(BigDecimal.valueOf(86_400L * delivered), 1,
                RoundingMode.HALF_UP);
        Totals totals = new Totals(list.size(), delivered, returned, all.missingCost, money(all.charged),
                money(all.costs), money(all.margin), avgCharged == null ? null : money(avgCharged), avgDays);

        List<Point> series = new ArrayList<>();
        buckets.forEach((period, acc) -> series.add(new Point(period, acc.count, money(acc.charged), money(acc.costs),
                money(acc.margin))));
        List<CourierRow> couriers = byCourier.entrySet().stream()
                .map(e -> new CourierRow(e.getKey(), e.getValue().count, money(e.getValue().costs)))
                .sorted(Comparator.comparingInt(CourierRow::shipments).reversed()).toList();
        List<CountryRow> countries = byCountry.entrySet().stream()
                .map(e -> new CountryRow(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingInt(CountryRow::shipments).reversed()).toList();
        List<StatusRow> statuses = byStatus.entrySet().stream()
                .map(e -> new StatusRow(e.getKey(), e.getValue())).toList();
        return new Summary(from, to, grouping, totals, series, couriers, countries, statuses);
    }

    /** From the BOOKED step to the DELIVERED step, when both exist. */
    static Optional<Duration> timeToDeliver(Shipment s) {
        Instant booked = null;
        Instant deliveredAt = null;
        for (TrackingEvent e : s.getEvents()) {
            if (e.getStatus() == TrackingStatus.BOOKED && booked == null) {
                booked = e.getOccurredAt();
            }
            if (e.getStatus() == TrackingStatus.DELIVERED) {
                deliveredAt = e.getOccurredAt();
            }
        }
        return booked != null && deliveredAt != null ? Optional.of(Duration.between(booked, deliveredAt))
                : Optional.empty();
    }

    static List<String> periods(LocalDate from, LocalDate to, Grouping grouping) {
        List<String> out = new ArrayList<>();
        if (grouping == Grouping.DAY) {
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                out.add(d.toString());
            }
        } else {
            for (YearMonth m = YearMonth.from(from); !m.isAfter(YearMonth.from(to)); m = m.plusMonths(1)) {
                out.add(m.toString());
            }
        }
        return out;
    }

    private static String period(Instant at, Grouping grouping) {
        LocalDate date = at.atZone(StoreDefaults.ZONE).toLocalDate();
        return grouping == Grouping.DAY ? date.toString() : YearMonth.from(date).toString();
    }

    private static MoneyResponse money(BigDecimal value) {
        return MoneyResponse.of(value, CURRENCY);
    }

    /** Running totals; the margin only counts parcels where both sides are known. */
    private static final class Acc {
        int count;
        int missingCost;
        BigDecimal charged = BigDecimal.ZERO;
        BigDecimal costs = BigDecimal.ZERO;
        BigDecimal margin = BigDecimal.ZERO;

        void add(BigDecimal deliveryCharged, BigDecimal courierCost) {
            count++;
            if (deliveryCharged != null) {
                charged = charged.add(deliveryCharged);
            }
            if (courierCost == null) {
                missingCost++;
            } else {
                costs = costs.add(courierCost);
            }
            if (deliveryCharged != null && courierCost != null) {
                margin = margin.add(deliveryCharged.subtract(courierCost));
            }
        }
    }
}
