package lk.swiftdrop.identity;

import java.util.EnumSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the first administrator at startup from ADMIN_EMAIL and
 * ADMIN_PASSWORD (set in the git-ignored .env file). There is deliberately
 * NO public "register as admin" endpoint.
 *
 * <p>It does nothing if an administrator already exists, so it is safe to
 * leave the settings in place; removing ADMIN_PASSWORD after the first start
 * is still good practice.
 */
@Component
public class AdminProvisioner implements ApplicationRunner {

    static final int MIN_PASSWORD_LENGTH = 12;
    private static final Logger log = LoggerFactory.getLogger(AdminProvisioner.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;

    public AdminProvisioner(
            UserRepository users,
            PasswordEncoder passwordEncoder,
            @Value("${app.admin.email:}") String email,
            @Value("${app.admin.password:}") String password) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.existsByRole(Role.ADMIN)) {
            return;
        }
        if (email.isBlank()) {
            log.warn("No administrator exists yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env and restart.");
            return;
        }
        if (password.length() < MIN_PASSWORD_LENGTH) {
            // Fail fast: never create an admin with a weak password.
            throw new IllegalStateException(
                    "ADMIN_PASSWORD must be at least " + MIN_PASSWORD_LENGTH + " characters long.");
        }
        users.save(new User(email, passwordEncoder.encode(password), "Administrator", EnumSet.of(Role.ADMIN)));
        // The email and password are not logged: logs must not contain personal data or secrets.
        log.info("Initial administrator account created.");
    }
}
