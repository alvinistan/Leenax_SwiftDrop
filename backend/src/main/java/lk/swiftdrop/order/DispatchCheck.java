package lk.swiftdrop.order;

import java.util.ArrayList;
import java.util.List;

/**
 * May this order be handed to a courier? Pure rules, no database (unit tested).
 *
 * <ul>
 *   <li>The order must be CONFIRMED (nothing is shipped just because it was placed).</li>
 *   <li>"Arrange payment" orders must be PAID first. The owner may override with a
 *       written reason (e.g. a trusted repeat customer); COD is paid on delivery.</li>
 *   <li>International parcels need an HS code and a customs description for every product.</li>
 *   <li>Warning only: a product's country rules changed after the order was placed.</li>
 * </ul>
 */
public final class DispatchCheck {

    /**
     * @param paymentOverridable true when the ONLY blocker is a missing payment (the owner may override it)
     */
    public record Result(boolean ready, List<String> blockers, List<String> warnings, boolean paymentOverridable) {
    }

    /** What the rules need to know about the products in the order. */
    public record ProductFacts(String name, boolean hasCustomsDetails, boolean stillAllowedToDestination) {
    }

    private DispatchCheck() {
    }

    public static Result evaluate(OrderStatus status, PaymentMethod method, CustomerOrder.PaymentStatus payment,
                                  boolean domestic, List<ProductFacts> products) {
        List<String> blockers = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        boolean paymentMissing = false;

        if (status != OrderStatus.CONFIRMED && status != OrderStatus.SHIPPED) {
            blockers.add(status == OrderStatus.PLACED
                    ? "Confirm the order first."
                    : "The order is " + status.name().toLowerCase() + ".");
        }
        if (method == PaymentMethod.ARRANGE_LATER && payment != CustomerOrder.PaymentStatus.PAID) {
            blockers.add("Payment has not been received. Mark the order as paid, or ship anyway with a reason.");
            paymentMissing = true;
        }
        if (!domestic) {
            List<String> missing = products.stream().filter(p -> !p.hasCustomsDetails()).map(ProductFacts::name).toList();
            if (!missing.isEmpty()) {
                blockers.add("Customs details (HS code and description) are missing for: " + String.join(", ", missing) + ".");
            }
        }
        products.stream().filter(p -> !p.stillAllowedToDestination()).forEach(p -> warnings.add(
                p.name() + " is now blocked for this country. Check with the courier before shipping."));

        return new Result(blockers.isEmpty(), List.copyOf(blockers), List.copyOf(warnings),
                paymentMissing && blockers.size() == 1);
    }
}
