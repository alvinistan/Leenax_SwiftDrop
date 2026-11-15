package lk.swiftdrop.delivery;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.money.MoneyResponse;
import lk.swiftdrop.identity.User;
import lk.swiftdrop.order.CustomerOrder;
import lk.swiftdrop.order.PaymentMethod;
import lk.swiftdrop.shipping.audit.ShippingAuditService;
import lk.swiftdrop.shipping.audit.ShippingAuditService.Action;
import lk.swiftdrop.shipping.shipment.Shipment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cash on delivery: recorded when the parcel is delivered, and the order is
 * marked paid only when the owner confirms the cash reached them.
 */
@Service
@Transactional(readOnly = true)
public class CodService {

    private final CodCollectionRepository collections;
    private final ShippingAuditService audit;
    private final Clock clock;

    public CodService(CodCollectionRepository collections, ShippingAuditService audit, Clock clock) {
        this.collections = collections;
        this.audit = audit;
        this.clock = clock;
    }

    /** True when delivering this order means someone collects cash for it. */
    public static boolean collectsCash(CustomerOrder order) {
        return order != null && order.getPaymentMethod() == PaymentMethod.COD
                && order.getPaymentStatus() == CustomerOrder.PaymentStatus.UNPAID;
    }

    /**
     * A parcel was delivered. For an unpaid COD order, record who now holds the
     * cash: the staff member (own delivery) or the courier.
     *
     * @param staff who collected it (own delivery); null = the courier
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordDelivery(Shipment shipment, User staff, Instant at) {
        CustomerOrder order = shipment.getOrder();
        if (!collectsCash(order) || collections.existsByOrderId(order.getId())) {
            return; // not COD, already paid, or cash already recorded with an earlier parcel
        }
        CodCollection c = staff != null
                ? CodCollection.heldByStaff(order, shipment, staff, at)
                : CodCollection.heldByCourier(order, shipment, at);
        collections.save(c);
        audit.record("COD_COLLECTION", order.getOrderNumber(), Action.CREATE, null, AuditView.of(c));
    }

    /** The owner marked the order paid on the order page: the cash is no longer owed. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void settleForOrder(CustomerOrder order, String actor) {
        collections.findByOrderIdAndStatus(order.getId(), CodCollection.Status.HELD).ifPresent(c -> {
            AuditView before = AuditView.of(c);
            c.settle("Marked paid on the order page", actor, clock.instant());
            audit.record("COD_COLLECTION", order.getOrderNumber(), Action.UPDATE, before, AuditView.of(c));
        });
    }

    /** Cash still owed to the owner (per holder) and the latest received. */
    public CodOverview overview() {
        Instant now = clock.instant();
        List<CodView> held = collections.findAllByStatusOrderByCollectedAtAsc(CodCollection.Status.HELD).stream()
                .map(c -> CodView.of(c, now)).toList();
        Map<String, HolderTotalView> byHolder = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        for (CodView v : held) {
            BigDecimal amount = new BigDecimal(v.amount().amount());
            total = total.add(amount);
            byHolder.merge(v.holderType() + "|" + v.holderName(),
                    new HolderTotalView(v.holderType(), v.holderName(), 1, v.amount()),
                    (a, b) -> new HolderTotalView(a.holderType(), a.holderName(), a.count() + 1,
                            MoneyResponse.of(new BigDecimal(a.amount().amount()).add(amount), "LKR")));
        }
        List<CodView> settled = collections.findTop100ByStatusOrderBySettledAtDesc(CodCollection.Status.SETTLED)
                .stream().map(c -> CodView.of(c, now)).toList();
        return new CodOverview(MoneyResponse.of(total, "LKR"), List.copyOf(byHolder.values()), held, settled);
    }

    /** The courier or staff member handed over the cash for these orders. All or nothing. */
    @Transactional
    public CodOverview settle(List<UUID> ids, String reference) {
        if (new HashSet<>(ids).size() != ids.size()) {
            throw new BadRequestException("Each collection may be listed only once.");
        }
        List<CodCollection> found = collections.findAllByIdIn(ids);
        if (found.size() != ids.size()) {
            throw new BadRequestException("Some of these collections were not found. Reload the page.");
        }
        String actor = ShippingAuditService.currentUser();
        Instant now = clock.instant();
        String ref = reference == null || reference.isBlank() ? null : reference.trim();
        for (CodCollection c : found) {
            AuditView before = AuditView.of(c);
            c.settle(ref, actor, now);
            CustomerOrder order = c.getOrder();
            if (order.getPaymentStatus() == CustomerOrder.PaymentStatus.UNPAID) {
                order.markPaid("Cash on delivery received from " + c.holderName()
                        + (ref == null ? "" : " (ref " + ref + ")"), actor);
            }
            audit.record("COD_COLLECTION", order.getOrderNumber(), Action.UPDATE, before, AuditView.of(c));
        }
        collections.flush(); // optimistic lock: two people settling at once → 409
        return overview();
    }

    // ------------------------------------------------------------------

    public record CodView(UUID id, String orderNumber, MoneyResponse amount, CodCollection.HolderType holderType,
                          String holderName, String reference, Instant collectedAt, long daysHeld,
                          CodCollection.Status status, Instant settledAt, String settledBy,
                          String settlementReference) {

        static CodView of(CodCollection c, Instant now) {
            Instant end = c.getSettledAt() != null ? c.getSettledAt() : now;
            return new CodView(c.getId(), c.getOrder().getOrderNumber(), MoneyResponse.of(c.getAmount(), c.getCurrency()),
                    c.getHolderType(), c.holderName(), c.getShipment().getAwb(), c.getCollectedAt(),
                    Math.max(0, Duration.between(c.getCollectedAt(), end).toDays()), c.getStatus(), c.getSettledAt(),
                    c.getSettledBy(), c.getSettlementReference());
        }
    }

    public record HolderTotalView(CodCollection.HolderType holderType, String holderName, int count,
                                  MoneyResponse amount) {
    }

    public record CodOverview(MoneyResponse totalHeld, List<HolderTotalView> byHolder, List<CodView> held,
                              List<CodView> recentlyReceived) {
    }

    /** What the change history stores. */
    record AuditView(String order, BigDecimal amount, String holder, CodCollection.Status status, String reference) {

        static AuditView of(CodCollection c) {
            return new AuditView(c.getOrder().getOrderNumber(), c.getAmount(), c.holderName(), c.getStatus(),
                    c.getSettlementReference());
        }
    }
}
