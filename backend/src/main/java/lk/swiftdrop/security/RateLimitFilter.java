package lk.swiftdrop.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Limits how often one client (IP address) may call the API, with stricter
 * limits for login, sign-up, checkout and the public price endpoints, plus
 * the per-account login lockout. Answers 429 Too Many Requests with a
 * Retry-After header.
 *
 * <p>The IP is request.getRemoteAddr(). Behind a load balancer, set
 * FORWARD_HEADERS_STRATEGY=native so it is the real client's address; never
 * trust X-Forwarded-For from the internet directly (anyone can fake it).
 */
/** Created in SecurityConfig (so every test that loads the security setup has it). */
public class RateLimitFilter extends OncePerRequestFilter {

    private record Rule(String method, String path, boolean prefix, String name, TokenBucketLimiter limiter) {

        boolean matches(HttpServletRequest request) {
            String uri = request.getRequestURI();
            return (method == null || method.equals(request.getMethod()))
                    && (prefix ? uri.startsWith(path) : uri.equals(path));
        }
    }

    private final boolean enabled;
    private final List<Rule> rules;
    private final TokenBucketLimiter general;
    private final LoginAttemptService loginAttempts;

    public RateLimitFilter(RateLimitProperties p, LoginAttemptService loginAttempts, Clock clock) {
        this.enabled = p.enabled();
        this.loginAttempts = loginAttempts;
        this.rules = List.of(
                new Rule("POST", "/api/auth/login", false, "login", limiter(p.login(), clock)),
                new Rule("POST", "/api/auth/password", false, "password", limiter(p.login(), clock)),
                new Rule("POST", "/api/auth/register", false, "register", limiter(p.register(), clock)),
                new Rule("POST", "/api/shipping/quotes", false, "quotes", limiter(p.quotes(), clock)),
                new Rule("POST", "/api/cart/price", false, "cart", limiter(p.cartPrice(), clock)),
                new Rule("POST", "/api/orders", false, "checkout", limiter(p.checkout(), clock)),
                new Rule("POST", "/api/payments/payhere/notify", false, "notify", limiter(p.paymentNotify(), clock)));
        this.general = limiter(p.api(), clock);
    }

    private static TokenBucketLimiter limiter(RateLimitProperties.Limit limit, Clock clock) {
        return new TokenBucketLimiter(limit.requests(), limit.per(), clock);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || !request.getRequestURI().startsWith("/api/") || "OPTIONS".equals(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String ip = request.getRemoteAddr();
        TokenBucketLimiter.Decision general = this.general.tryAcquire(ip);
        if (!general.allowed()) {
            tooMany(response, general.retryAfterSeconds(),
                    "Too many requests. Please wait " + general.retryAfterSeconds() + " seconds and try again.");
            return;
        }
        for (Rule rule : rules) {
            if (rule.matches(request)) {
                TokenBucketLimiter.Decision d = rule.limiter().tryAcquire(ip);
                if (!d.allowed()) {
                    tooMany(response, d.retryAfterSeconds(),
                            "Too many attempts. Please wait " + d.retryAfterSeconds() + " seconds and try again.");
                    return;
                }
                break;
            }
        }
        if ("POST".equals(request.getMethod()) && "/api/auth/login".equals(request.getRequestURI())) {
            Optional<Duration> locked = loginAttempts.lockedFor(request.getParameter("email"));
            if (locked.isPresent()) {
                long minutes = Math.max(1, (locked.get().toSeconds() + 59) / 60);
                tooMany(response, locked.get().toSeconds() + 1, "Too many failed logins for this email. Try again in "
                        + minutes + (minutes == 1 ? " minute." : " minutes."));
                return;
            }
        }
        chain.doFilter(request, response);
    }

    /** Every 5 minutes: forget clients that have been quiet (memory stays small). */
    @Scheduled(fixedDelay = 300_000, initialDelay = 300_000)
    void evictIdle() {
        general.evictIdle();
        rules.forEach(r -> r.limiter().evictIdle());
        loginAttempts.evictExpired();
    }

    /** RFC 9457 problem JSON, like the rest of the API. The text is fixed, never user input. */
    private static void tooMany(HttpServletResponse response, long retryAfterSeconds, String detail)
            throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        response.setContentType("application/problem+json");
        response.getWriter().write("""
                {"title":"Too Many Requests","status":429,"detail":"%s"}""".formatted(detail));
    }
}
