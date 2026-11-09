package lk.swiftdrop.identity;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tells Spring Security how to find a user at login. Spring Security then
 * checks the password against the stored hash itself.
 */
@Service
public class AppUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public AppUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) {
        User user = users.findByEmail(User.normalizeEmail(email))
                // The message never reaches the client: a wrong email and a wrong
                // password produce the same "incorrect email or password" answer.
                .orElseThrow(() -> new UsernameNotFoundException("Unknown user"));
        return org.springframework.security.core.userdetails.User
                .withUsername(user.getEmail())
                .password(user.getPasswordHash())
                .roles(user.getRoles().stream().map(Role::name).toArray(String[]::new))
                .disabled(!user.isEnabled())
                .build();
    }
}
