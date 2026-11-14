package lk.swiftdrop.catalog.product;

/**
 * What kind of goods a product is, for shipping. It decides where a product
 * may be sent. The default rules below are a starting point: couriers and
 * destination countries have their own rules for food (especially animal
 * products such as dried fish), which the owner must confirm.
 */
public enum ShippingCategory {
    /** Ordinary goods (clothes, kitchenware...). */
    GENERAL(true),
    /** Packed food that keeps for weeks: rich cake, sweets, dried fish. */
    FOOD_SHELF_STABLE(true),
    /** Food that spoils quickly: fresh cakes. Sri Lanka only. */
    FOOD_PERISHABLE(false),
    /** Breakable items that need special packaging. */
    FRAGILE(true);

    private final boolean internationalByDefault;

    ShippingCategory(boolean internationalByDefault) {
        this.internationalByDefault = internationalByDefault;
    }

    /** Whether international shipping is offered by default (per-country rules come in Phase C). */
    public boolean isInternationalByDefault() {
        return internationalByDefault;
    }
}
