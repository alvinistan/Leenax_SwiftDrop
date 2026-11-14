package lk.swiftdrop.shipping.shipment;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.money.MoneyResponse;
import lk.swiftdrop.store.StoreDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Courier costs vs delivery charged to customers, for shipments created in a
 * period (Sri Lankan dates). The difference is the GROSS shipping margin: it
 * is not net profit (packing, card fees, staff time and losses are not in it).
 */
@Service
@Transactional(readOnly = true)
public class ExpenseReportService {

    private static final String CURRENCY = "LKR";
    private static final int MAX_DAYS = 366;

    /**
     * @param deliveryCharged null for orders taken outside the website, and for a second parcel of the
     *                        same order (the delivery charge is counted once, on the first parcel)
     * @param courierBase     null when the courier's charge was not entered yet
     * @param margin          null when either side is unknown
     */
    public record Row(UUID shipmentId, Instant createdAt, String orderReference, boolean websiteOrder,
                      String providerName, String awb, TrackingStatus status, MoneyResponse deliveryCharged,
                      MoneyResponse courierBase, MoneyResponse extraCharges, MoneyResponse totalCourierCost,
                      MoneyResponse margin) {
    }

    public record Report(LocalDate from, LocalDate to, List<Row> rows, int shipmentCount,
                         int shipmentsWithoutCourierCost, MoneyResponse deliveryCharged,
                         MoneyResponse courierCosts, MoneyResponse grossMargin) {
    }

    private final ShipmentRepository shipments;
    private final CourierExpenseRepository expenses;

    public ExpenseReportService(ShipmentRepository shipments, CourierExpenseRepository expenses) {
        this.shipments = shipments;
        this.expenses = expenses;
    }

    public Report report(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new BadRequestException("The end date must not be before the start date.");
        }
        if (from.plusDays(MAX_DAYS).isBefore(to)) {
            throw new BadRequestException("Choose a period of at most one year.");
        }
        Instant start = from.atStartOfDay(StoreDefaults.ZONE).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(StoreDefaults.ZONE).toInstant();
        List<Shipment> list = shipments.findAllByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(start, end);
        Map<UUID, BigDecimal> extrasByShipment = list.isEmpty() ? Map.of()
                : expenses.findAllByShipmentIdIn(list.stream().map(Shipment::getId).toList()).stream()
                .collect(Collectors.groupingBy(e -> e.getShipment().getId(),
                        Collectors.reducing(BigDecimal.ZERO, CourierExpense::getAmount, BigDecimal::add)));

        List<Row> rows = new ArrayList<>();
        Set<UUID> ordersCounted = new HashSet<>();
        BigDecimal charged = BigDecimal.ZERO;
        BigDecimal costs = BigDecimal.ZERO;
        BigDecimal margin = BigDecimal.ZERO;
        int missingCost = 0;
        for (Shipment s : list) {
            BigDecimal delivery = s.getOrder() != null && ordersCounted.add(s.getOrder().getId())
                    ? s.getOrder().getShippingPrice() : null;
            BigDecimal extras = extrasByShipment.getOrDefault(s.getId(), BigDecimal.ZERO);
            BigDecimal total = s.getCourierCost() == null ? null : s.getCourierCost().add(extras);
            BigDecimal rowMargin = delivery != null && total != null ? delivery.subtract(total) : null;
            if (total == null) {
                missingCost++;
            } else {
                costs = costs.add(total);
            }
            if (delivery != null) {
                charged = charged.add(delivery);
            }
            if (rowMargin != null) {
                margin = margin.add(rowMargin);
            }
            rows.add(new Row(s.getId(), s.getCreatedAt(), s.getOrderReference(), s.getOrder() != null,
                    s.getProvider().getName(), s.getAwb(), s.getStatus(), money(delivery), money(s.getCourierCost()),
                    money(extras), money(total), money(rowMargin)));
        }
        return new Report(from, to, rows, list.size(), missingCost, money(charged), money(costs), money(margin));
    }

    private static MoneyResponse money(BigDecimal value) {
        return value == null ? null : MoneyResponse.of(value, CURRENCY);
    }
}
