package lk.swiftdrop.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Account lockout: after N failed logins for the same email within the lock
 * period, further attempts for that email are refused until the period has
 * passed (even with the right password), so passwords cannot be guessed.
 *
 * <p>It works the same for emails that have no account, so it does not reveal
 * which accounts exist. A successful login clears the count.
 */
/** Created in SecurityConfig. */
public class LoginAttemptService {

    private final int maxFailures;
    private final Duration lockDuration;
    private final Clock clock;
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    public LoginAttemptService(RateLimitProperties properties, Clock clock) {
        this.maxFailures = properties.maxFailedLogins();
        this.lockDuration = properties.lockDuration();
        this.clock = clock;
    }

    /** Locked: how long until the next attempt is allowed. */
    public Optional<Duration> lockedFor(String email) {
        Deque<Instant> list = failures.get(key(email));
        if (list == null) {
            return Optional.empty();
        }
        synchronized (list) {
            prune(list);
            if (list.size() < maxFailures) {
                return Optional.empty();
            }
            Duration left = Duration.between(clock.instant(), list.peekLast().plus(lockDuration));
            return left.isNegative() || left.isZero() ? Optional.empty() : Optional.of(left);
        }
    }

    public void failed(String email) {
        Deque<Instant> list = failures.computeIfAbsent(key(email), k -> new ArrayDeque<>());
        synchronized (list) {
            prune(list);
            list.addLast(clock.instant());
            while (list.size() > maxFailures) {
                list.removeFirst();
            }
        }
    }

    public void succeeded(String email) {
        failures.remove(key(email));
    }

    /** Drops emails whose failures are all older than the lock period. */
    public void evictExpired() {
        failures.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                prune(e.getValue());
                return e.getValue().isEmpty();
            }
        });
    }

    private void prune(Deque<Instant> list) {
        Instant cutoff = clock.instant().minus(lockDuration);
        while (!list.isEmpty() && list.peekFirst().isBefore(cutoff)) {
            list.removeFirst();
        }
    }

    private static String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
