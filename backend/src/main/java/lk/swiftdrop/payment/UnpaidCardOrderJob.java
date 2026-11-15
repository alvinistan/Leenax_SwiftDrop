package lk.swiftdrop.payment;

import java.time.Clock;
import java.time.Duration;
import lk.swiftdrop.order.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Every 15 minutes: card orders that were not paid within the time limit
 * (default 2 hours) are cancelled, so their stock goes back on sale.
 */
@Component
public class UnpaidCardOrderJob {

    private static final Logger log = LoggerFactory.getLogger(UnpaidCardOrderJob.class);

    private final OrderService orders;
    private final Clock clock;
    private final Duration timeout;

    public UnpaidCardOrderJob(OrderService orders, Clock clock,
                              @Value("${app.payhere.unpaid-timeout:PT2H}") Duration timeout) {
        this.orders = orders;
        this.clock = clock;
        this.timeout = timeout;
    }

    @Scheduled(fixedDelayString = "PT15M", initialDelayString = "PT5M")
    public int cancelUnpaid() {
        int cancelled = orders.cancelUnpaidCardOrders(clock.instant().minus(timeout));
        if (cancelled > 0) {
            log.info("Cancelled {} unpaid card order(s) and returned their stock.", cancelled);
        }
        return cancelled;
    }
}
