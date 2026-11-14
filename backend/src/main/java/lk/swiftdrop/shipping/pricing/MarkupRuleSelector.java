package lk.swiftdrop.shipping.pricing;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Chooses the markup rule for one quote option:
 * <ol>
 *   <li>only rules that are enabled and valid right now, and whose scope covers the courier and country;</li>
 *   <li>the MOST SPECIFIC wins: courier + country, then courier, then country, then the default;</li>
 *   <li>ties: the higher priority, then the most recent start date.</li>
 * </ol>
 * No rule → no platform fee (0).
 */
public final class MarkupRuleSelector {

    private MarkupRuleSelector() {
    }

    public static Optional<MarkupRule> select(List<MarkupRule> rules, UUID providerId, String country, Instant now) {
        return rules.stream()
                .filter(rule -> rule.isActiveAt(now) && rule.covers(providerId, country))
                .max(Comparator.comparingInt(MarkupRule::specificity)
                        .thenComparingInt(MarkupRule::getPriority)
                        .thenComparing(MarkupRule::getEffectiveFrom));
    }
}
