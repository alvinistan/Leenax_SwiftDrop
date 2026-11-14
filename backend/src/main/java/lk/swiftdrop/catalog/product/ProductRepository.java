package lk.swiftdrop.catalog.product;

import java.util.List;
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

    /**
     * Admin list with optional filters. :pattern is a LIKE pattern built by the
     * service with % and _ escaped (see ProductService.likePattern), so a search
     * for "100%" finds "100%" instead of everything starting with "100".
     */
    @EntityGraph(attributePaths = "category")
    @Query("""
            SELECT p FROM Product p
            WHERE (:status IS NULL OR p.status = :status)
              AND (:pattern IS NULL OR LOWER(p.name) LIKE :pattern ESCAPE '\\')
            """)
    Page<Product> searchForAdmin(
            @Param("status") ProductStatus status, @Param("pattern") String pattern, Pageable pageable);

    /** Products with their own shipping restrictions (Sri Lanka only, or extra blocked countries). */
    @EntityGraph(attributePaths = "shippingBlockedCountries")
    @Query("""
            SELECT p FROM Product p
            WHERE p.shippingDomesticOnly = true OR p.shippingBlockedCountries IS NOT EMPTY
            ORDER BY p.name
            """)
    List<Product> findWithOwnShippingRestrictions();
}
