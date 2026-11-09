package lk.swiftdrop.identity;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    @Query("SELECT COUNT(u) > 0 FROM User u JOIN u.roles r WHERE r = :role")
    boolean existsByRole(@Param("role") Role role);
}
