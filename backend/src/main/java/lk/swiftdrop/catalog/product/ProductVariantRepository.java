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
}
