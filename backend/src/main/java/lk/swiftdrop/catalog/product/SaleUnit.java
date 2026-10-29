package lk.swiftdrop.catalog.product;

/** How a variant is sold, and what its price is "per". */
public enum SaleUnit {
    /** Price per piece; whole-number quantities. Fixed sizes like "Cake 1 kg" are pieces too. */
    PIECE,
    /** Price per kilogram; the customer chooses a weight, e.g. 1.5 kg. */
    KG
}
