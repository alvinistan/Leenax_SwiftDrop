package lk.swiftdrop.shipping.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MarkupRuleSelectorTest {

    private static final Instant NOW = Instant.parse("2026-11-14T10:00:00Z");
    private static final Instant LAST_YEAR = Instant.parse("2025-11-14T10:00:00Z");
    private static final UUID DHL = UUID.randomUUID();
    private static final UUID DEX = UUID.randomUUID();

    private static MarkupRule rule(String name, UUID provider, String country, int priority, Instant from, Instant to,
                                   boolean enabled) {
        MarkupRule rule = new MarkupRule(name);
        rule.update(name, MarkupType.PERCENT, new BigDecimal("2.00"), null, null, null, provider, country, from, to,
                enabled, priority);
        return rule;
    }

    private static MarkupRule rule(String name, UUID provider, String country) {
        return rule(name, provider, country, 0, LAST_YEAR, null, true);
    }

    @Test
    void theMostSpecificRuleWins() {
        List<MarkupRule> rules = List.of(
                rule("default", null, null),
                rule("country", null, "GB"),
                rule("courier", DHL, null),
                rule("courier+country", DHL, "GB"));

        assertThat(MarkupRuleSelector.select(rules, DHL, "GB", NOW)).get().extracting(MarkupRule::getName)
                .isEqualTo("courier+country");
        assertThat(MarkupRuleSelector.select(rules, DHL, "FR", NOW)).get().extracting(MarkupRule::getName)
                .isEqualTo("courier");
        assertThat(MarkupRuleSelector.select(rules, DEX, "GB", NOW)).get().extracting(MarkupRule::getName)
                .isEqualTo("country");
        assertThat(MarkupRuleSelector.select(rules, DEX, "LK", NOW)).get().extracting(MarkupRule::getName)
                .isEqualTo("default");
    }

    @Test
    void disabledExpiredAndFutureRulesAreIgnored() {
        List<MarkupRule> rules = List.of(
                rule("default", null, null),
                rule("disabled", null, "GB", 0, LAST_YEAR, null, false),
                rule("expired", null, "GB", 0, LAST_YEAR, NOW, false),
                rule("ended", null, "GB", 0, LAST_YEAR, NOW, true), // the end is exclusive
                rule("future", null, "GB", 0, NOW.plusSeconds(60), null, true));

        assertThat(MarkupRuleSelector.select(rules, DHL, "GB", NOW)).get().extracting(MarkupRule::getName)
                .isEqualTo("default");
    }

    @Test
    void tiesGoToPriorityThenTheNewestStart() {
        List<MarkupRule> rules = List.of(
                rule("old", null, null, 0, LAST_YEAR, null, true),
                rule("newer", null, null, 0, NOW.minusSeconds(60), null, true),
                rule("low", null, "GB", 1, LAST_YEAR, null, true),
                rule("high", null, "GB", 5, LAST_YEAR, null, true));

        assertThat(MarkupRuleSelector.select(rules, DEX, "LK", NOW)).get().extracting(MarkupRule::getName)
                .isEqualTo("newer");
        assertThat(MarkupRuleSelector.select(rules, DEX, "GB", NOW)).get().extracting(MarkupRule::getName)
                .isEqualTo("high");
    }

    @Test
    void noRuleMeansNoFee() {
        assertThat(MarkupRuleSelector.select(List.of(), DEX, "LK", NOW)).isEmpty();
    }
}
