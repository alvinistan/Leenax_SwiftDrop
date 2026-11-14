package lk.swiftdrop.order;

import java.util.EnumSet;
import java.util.Set;

/** An order's progress. Changes follow fixed steps; every change is kept in the history. */
public enum OrderStatus {
    /** Placed by the customer; the owner has not confirmed it yet. */
    PLACED,
    /** The owner accepted it (payment arranged or COD agreed). */
    CONFIRMED,
    /** Handed to the courier. */
    SHIPPED,
    DELIVERED,
    CANCELLED;

    public Set<OrderStatus> allowedNext() {
        return switch (this) {
            case PLACED -> EnumSet.of(CONFIRMED, CANCELLED);
            case CONFIRMED -> EnumSet.of(SHIPPED, CANCELLED);
            case SHIPPED -> EnumSet.of(DELIVERED);
            case DELIVERED, CANCELLED -> EnumSet.noneOf(OrderStatus.class);
        };
    }
}
