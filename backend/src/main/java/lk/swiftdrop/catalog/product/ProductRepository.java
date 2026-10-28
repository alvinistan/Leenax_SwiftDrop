package lk.swiftdrop.catalog.product;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, UUID id);

    boolean existsByCategoryId(UUID categoryId);

    /**
     * Storefront listing: active products in active categories, optionally in one
     * category. JPQL works with entity and field names, not table names. The
     * :parameters are bound safely, never concatenated into the SQL.
     *
     * <p>@EntityGraph loads each product's category in the same query, avoiding
     * one extra query per product (the "N+1 problem").
     */
    @EntityGraph(attributePaths = "category")
    @Query("""
            SELECT p FROM Product p
            WHERE p.status = lk.swiftdrop.catalog.product.ProductStatus.ACTIVE
              AND p.category.active = true
              AND (:categorySlug IS NULL OR p.category.slug = :categorySlug)
            """)
    Page<Product> findVisible(@Param("categorySlug") String categorySlug, Pageable pageable);

    @EntityGraph(attributePaths = "category")
    @Query("""
            SELECT p FROM Product p
            WHERE p.slug = :slug
              AND p.status = lk.swiftdrop.catalog.product.ProductStatus.ACTIVE
              AND p.category.active = true
            """)
    Optional<Product> findVisibleBySlug(@Param("slug") String slug);

    @EntityGraph(attributePaths = "category")
    Page<Product> findAllBy(Pageable pageable);
}
