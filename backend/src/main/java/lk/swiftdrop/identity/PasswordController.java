package lk.swiftdrop.identity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.security.LoginAttemptService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/auth/password: any logged-in user (owner, staff, customer) changes
 * their own password. The current password is required, so someone who finds
 * an unlocked computer cannot take over the account.
 */
@RestController
@RequestMapping("/api/auth")
public class PasswordController {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptService loginAttempts;

    public PasswordController(UserRepository users, PasswordEncoder passwordEncoder,
                              LoginAttemptService loginAttempts) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.loginAttempts = loginAttempts;
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Enter your current password.") @Size(max = 128) String currentPassword,
            @NotBlank(message = "Enter a new password.")
            @Size(min = AdminProvisioner.MIN_PASSWORD_LENGTH, max = 128,
                    message = "Use a password of 12 to 128 characters.") String newPassword) {
    }

    @PostMapping("/password")
    @Transactional
    public ResponseEntity<Void> change(@AuthenticationPrincipal UserDetails principal,
                                       @Valid @RequestBody ChangePasswordRequest request,
                                       HttpServletRequest http) {
        User user = users.findByEmail(principal.getUsername())
                .filter(User::isEnabled)
                .orElseThrow(() -> new AccessDeniedException("No active account"));
        if (loginAttempts.lockedFor(user.getEmail()).isPresent()) {
            throw new BadRequestException("Too many wrong passwords. Try again later.");
        }
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            loginAttempts.failed(user.getEmail()); // guessing here counts like a failed login
            throw new BadRequestException("Your current password is not correct.");
        }
        if (request.newPassword().equals(request.currentPassword())) {
            throw new BadRequestException("Choose a password different from the current one.");
        }
        user.changePasswordHash(passwordEncoder.encode(request.newPassword()));
        // A new session id after a credential change (the old id stops working).
        http.changeSessionId();
        return ResponseEntity.noContent().build();
    }
}
