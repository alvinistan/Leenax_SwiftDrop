package lk.swiftdrop.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.EnumSet;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.identity.AuthController.MeResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/auth/register: customers create their own account (they need one
 * to check out: no guest checkout, owner decision D-8). The new account is a
 * CUSTOMER only; admins are never created through this endpoint.
 */
@RestController
@RequestMapping("/api/auth")
public class RegistrationController {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public RegistrationController(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public record RegisterRequest(
            @NotBlank(message = "Email is required.")
            @Email(message = "Enter an email address like name@example.com.")
            @Size(max = 254) String email,
            @NotBlank(message = "Password is required.")
            @Size(min = AdminProvisioner.MIN_PASSWORD_LENGTH, max = 128,
                    message = "Use a password of 12 to 128 characters.") String password,
            @NotBlank(message = "Name is required.") @Size(max = 100) String displayName) {
    }

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<MeResponse> register(@Valid @RequestBody RegisterRequest request) {
        String email = User.normalizeEmail(request.email());
        if (users.findByEmail(email).isPresent()) {
            throw new ConflictException("An account with this email already exists. Log in instead.");
        }
        User user = users.save(new User(email, passwordEncoder.encode(request.password()),
                request.displayName().trim(), EnumSet.of(Role.CUSTOMER)));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new MeResponse(user.getEmail(), user.getDisplayName(), java.util.List.of(Role.CUSTOMER.name())));
    }
}
