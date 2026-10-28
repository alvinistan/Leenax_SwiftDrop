package lk.swiftdrop.common.money;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class MoneyResponseTest {

    @Test
    void usesTheCurrencysNumberOfDecimalPlaces() {
        assertThat(MoneyResponse.of(new BigDecimal("1450.0000"), "LKR"))
                .isEqualTo(new MoneyResponse("1450.00", "LKR"));
        // Japanese yen has no decimal places.
        assertThat(MoneyResponse.of(new BigDecimal("500"), "JPY").amount()).isEqualTo("500");
    }

    @Test
    void neverUsesScientificNotation() {
        assertThat(MoneyResponse.of(new BigDecimal("1E+3"), "LKR").amount()).isEqualTo("1000.00");
    }
}
