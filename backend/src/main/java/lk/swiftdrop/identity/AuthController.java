package lk.swiftdrop.identity;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/auth/me: who is logged in? 200 with the user, or 401 if nobody.
 *
 * <p>Login (POST /api/auth/login) and logout (POST /api/auth/logout) are
 * handled by Spring Security itself; see SecurityConfig.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository users;

    public AuthController(UserRepository users) {
        this.users = users;
    }

    public record MeResponse(String email, String displayName, List<String> roles) {
    }

    @GetMapping("/me")
    public ResponseEntity<MeResponse> me(@AuthenticationPrincipal UserDetails principal) {
        return users.findByEmail(principal.getUsername())
                .map(user -> ResponseEntity.ok(new MeResponse(
                        user.getEmail(),
                        user.getDisplayName(),
                        user.getRoles().stream().map(Role::name).sorted().toList())))
                // The account was deleted while its session was still open.
                .orElseGet(() -> ResponseEntity.status(401).build());
    }
}
