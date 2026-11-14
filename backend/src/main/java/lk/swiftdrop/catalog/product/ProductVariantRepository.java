package lk.swiftdrop.catalog.product;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, UUID> {

    /** Which of these SKUs are already used? One query instead of one per SKU. */
    @Query("SELECT v.sku FROM ProductVariant v WHERE v.sku IN :skus")
    List<String> findExistingSkus(@Param("skus") Collection<String> skus);

    /** The same check when editing: SKUs used by any OTHER product. */
    @Query("SELECT v.sku FROM ProductVariant v WHERE v.sku IN :skus AND v.product.id <> :productId")
    List<String> findSkusUsedByOtherProducts(
            @Param("skus") Collection<String> skus, @Param("productId") UUID productId);

    /** Variants with their product and category, in one query (used by shipping quotes). */
    @Query("SELECT v FROM ProductVariant v JOIN FETCH v.product p JOIN FETCH p.category WHERE v.id IN :ids")
    List<ProductVariant> findAllWithProductByIdIn(@Param("ids") Collection<UUID> ids);

    /**
     * Takes stock for an order, atomically: succeeds (1 row) only if enough is
     * left. Two customers buying the last item at the same moment cannot both
     * succeed, because the database checks and changes the row in one step.
     */
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE ProductVariant v SET v.stockQuantity = v.stockQuantity - :quantity "
            + "WHERE v.id = :id AND v.stockQuantity >= :quantity")
    int takeStock(@Param("id") UUID id, @Param("quantity") java.math.BigDecimal quantity);

    /** Puts stock back (cancelled order). */
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE ProductVariant v SET v.stockQuantity = v.stockQuantity + :quantity WHERE v.id = :id")
    int returnStock(@Param("id") UUID id, @Param("quantity") java.math.BigDecimal quantity);
}
