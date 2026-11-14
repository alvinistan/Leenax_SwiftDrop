package lk.swiftdrop.shipping.config;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PackagePresetRepository extends JpaRepository<PackagePreset, UUID> {

    List<PackagePreset> findAllByOrderByNameAsc();

    List<PackagePreset> findAllByEnabledTrue();

    boolean existsByNameAndIdNot(String name, UUID id);

    boolean existsByName(String name);
}
