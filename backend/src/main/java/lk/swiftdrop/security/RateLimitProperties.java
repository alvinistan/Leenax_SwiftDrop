package lk.swiftdrop.security;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Request limits per client IP address (app.rate-limit.* in application.yml).
 * A limit of "10 per 1 minute" allows short bursts of 10, refilled evenly.
 */
@ConfigurationProperties("app.rate-limit")
public record RateLimitProperties(
        boolean enabled,
        Limit login,
        Limit register,
        Limit quotes,
        Limit cartPrice,
        Limit checkout,
        Limit paymentNotify,
        Limit api,
        /** Failed logins for one email before it is locked for lockDuration. */
        int maxFailedLogins,
        Duration lockDuration) {

    public record Limit(int requests, Duration per) {
    }
}
