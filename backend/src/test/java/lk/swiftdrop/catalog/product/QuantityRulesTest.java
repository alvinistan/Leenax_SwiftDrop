package lk.swiftdrop.catalog.product;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class QuantityRulesTest {

    private static BigDecimal kg(String value) {
        return new BigDecimal(value);
    }

    @Test
    void cakeByWeightAllowsHalfKiloStepsWithinLimits() {
        QuantityRules rules = new QuantityRules(kg("0.5"), kg("5"), kg("0.5"));

        assertThat(rules.allows(kg("0.5"))).isTrue();
        assertThat(rules.allows(kg("1.5"))).isTrue();
        assertThat(rules.allows(kg("5.0"))).isTrue();

        assertThat(rules.allows(kg("0.25"))).as("below minimum").isFalse();
        assertThat(rules.allows(kg("1.3"))).as("not a 0.5 step").isFalse();
        assertThat(rules.allows(kg("5.5"))).as("above maximum").isFalse();
        assertThat(rules.allows(null)).isFalse();
    }

    @Test
    void piecesAreWholeNumbersWithNoUpperLimitByDefault() {
        QuantityRules rules = QuantityRules.defaultsFor(SaleUnit.PIECE);

        assertThat(rules.allows(BigDecimal.ONE)).isTrue();
        assertThat(rules.allows(new BigDecimal("250"))).isTrue();
        assertThat(rules.allows(new BigDecimal("1.5"))).isFalse();
        assertThat(rules.allows(BigDecimal.ZERO)).isFalse();
    }
}
