package lk.swiftdrop.tax;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaxRateRepository extends JpaRepository<TaxRate, UUID> {

    List<TaxRate> findAllByOrderByNameAsc();

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);

    @Query("SELECT COUNT(p) FROM Product p WHERE p.taxRate.id = :id")
    long countProductsUsing(@Param("id") UUID id);
}
