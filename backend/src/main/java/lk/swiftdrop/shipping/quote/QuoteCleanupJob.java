package lk.swiftdrop.shipping.quote;

import java.time.Clock;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every night, deletes delivery quotes that expired more than 7 days ago and
 * that no order uses (orders keep their own copy of the price). Keeps the
 * public quote endpoint from filling the database.
 */
@Component
public class QuoteCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(QuoteCleanupJob.class);
    static final Duration KEEP_AFTER_EXPIRY = Duration.ofDays(7);

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public QuoteCleanupJob(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** 03:15 Sri Lankan time. */
    @Scheduled(cron = "0 15 3 * * *", zone = "Asia/Colombo")
    @Transactional
    public int deleteOldUnusedQuotes() {
        java.sql.Timestamp cutoff = java.sql.Timestamp.from(clock.instant().minus(KEEP_AFTER_EXPIRY));
        int deleted = jdbc.update("""
                DELETE FROM shipping_quotes q
                WHERE q.expires_at < ?
                  AND NOT EXISTS (
                      SELECT 1 FROM shipping_quote_options o
                      JOIN orders ord ON ord.shipping_quote_option_id = o.id
                      WHERE o.quote_id = q.id)
                """, cutoff);
        if (deleted > 0) {
            log.info("Deleted {} old unused shipping quotes.", deleted);
        }
        return deleted;
    }
}
