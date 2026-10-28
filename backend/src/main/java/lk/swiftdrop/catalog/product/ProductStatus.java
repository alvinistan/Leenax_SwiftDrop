package lk.swiftdrop.catalog.product;

/** Only ACTIVE products are visible in the storefront. */
public enum ProductStatus {
    /** Being prepared by the admin; hidden from customers. */
    DRAFT,
    /** For sale. */
    ACTIVE,
    /** No longer sold; kept for history. */
    ARCHIVED
}
