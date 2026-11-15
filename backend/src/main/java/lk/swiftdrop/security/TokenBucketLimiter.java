package lk.swiftdrop.security;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * A "token bucket" per key (e.g. per IP address): the bucket holds up to
 * {@code capacity} tokens and refills at a steady rate. Each request takes one
 * token; an empty bucket means "too many requests, wait a little".
 *
 * <p>Kept in memory: right for one server. With several servers behind a load
 * balancer the limits would apply per server (or move to Redis), see
 * docs/SECURITY.md.
 */
public final class TokenBucketLimiter {

    /** Result of one attempt: allowed, or how many seconds to wait. */
    public record Decision(boolean allowed, long retryAfterSeconds) {
    }

    private final int capacity;
    private final double tokensPerNano;
    private final Clock clock;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    /** e.g. capacity 10, period 1 minute = 10 requests per minute, refilled evenly. */
    public TokenBucketLimiter(int capacity, Duration period, Clock clock) {
        if (capacity < 1 || period.isZero() || period.isNegative()) {
            throw new IllegalArgumentException("capacity and period must be positive");
        }
        this.capacity = capacity;
        this.tokensPerNano = capacity / (double) period.toNanos();
        this.clock = clock;
    }

    public Decision tryAcquire(String key) {
        long now = nanos();
        Bucket bucket = buckets.computeIfAbsent(key, k -> new Bucket(capacity, now));
        synchronized (bucket) {
            bucket.refill(now, capacity, tokensPerNano);
            if (bucket.tokens >= 1) {
                bucket.tokens -= 1;
                return new Decision(true, 0);
            }
            long waitNanos = (long) Math.ceil((1 - bucket.tokens) / tokensPerNano);
            return new Decision(false, Math.max(1, Duration.ofNanos(waitNanos).toSeconds() + 1));
        }
    }

    /** Forgets buckets that have refilled completely (they behave like new ones). Keeps memory small. */
    public void evictIdle() {
        long now = nanos();
        buckets.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                e.getValue().refill(now, capacity, tokensPerNano);
                return e.getValue().tokens >= capacity;
            }
        });
    }

    int size() {
        return buckets.size();
    }

    private long nanos() {
        return Duration.ofMillis(clock.millis()).toNanos();
    }

    private static final class Bucket {
        double tokens;
        long updatedAt;

        Bucket(int capacity, long now) {
            this.tokens = capacity;
            this.updatedAt = now;
        }

        void refill(long now, int capacity, double tokensPerNano) {
            if (now > updatedAt) {
                tokens = Math.min(capacity, tokens + (now - updatedAt) * tokensPerNano);
                updatedAt = now;
            }
        }
    }
}
