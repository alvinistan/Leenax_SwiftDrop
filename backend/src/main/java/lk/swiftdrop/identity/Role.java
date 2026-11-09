package lk.swiftdrop.identity;

/** What a user may do. Spring Security sees these as authorities "ROLE_ADMIN" etc. */
public enum Role {
    /** Manages the store (catalogue, orders, deliveries). */
    ADMIN,
    /** Shops and places orders (Phase 8). */
    CUSTOMER,
    /** Updates the deliveries assigned to them (Phase 10). */
    DELIVERY
}
