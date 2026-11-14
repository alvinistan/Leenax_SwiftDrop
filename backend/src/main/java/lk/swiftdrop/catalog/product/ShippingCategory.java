package lk.swiftdrop.catalog.product;

/**
 * What kind of goods a product is, for shipping. Where each category may be
 * sent (abroad at all, blocked countries) is set by the admin in
 * shipping_category_policies (Shipping → Country restrictions).
 */
public enum ShippingCategory {
    /** Ordinary goods (clothes, kitchenware...). */
    GENERAL,
    /** Packed food that keeps for weeks: rich cake, sweets, dried fish. */
    FOOD_SHELF_STABLE,
    /** Food that spoils quickly: fresh cakes. Sri Lanka only by default. */
    FOOD_PERISHABLE,
    /** Breakable items that need special packaging. */
    FRAGILE
}
