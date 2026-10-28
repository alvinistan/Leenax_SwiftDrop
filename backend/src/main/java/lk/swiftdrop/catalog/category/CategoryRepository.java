package lk.swiftdrop.catalog.category;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring Data writes the SQL for these methods from their names, e.g.
 * existsBySlug → SELECT ... WHERE slug = ?  (always with bound parameters,
 * which protects against SQL injection).
 */
public interface CategoryRepository extends JpaRepository<Category, UUID> {

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, UUID id);

    List<Category> findAllByActiveTrueOrderBySortOrderAscNameAsc();

    List<Category> findAllByOrderBySortOrderAscNameAsc();
}
