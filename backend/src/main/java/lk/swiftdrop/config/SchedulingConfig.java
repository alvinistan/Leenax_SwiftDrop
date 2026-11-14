package lk.swiftdrop.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Turns on @Scheduled jobs (e.g. QuoteCleanupJob, nightly). */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
