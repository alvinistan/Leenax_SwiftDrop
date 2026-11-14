package lk.swiftdrop.config;

import java.math.BigDecimal;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.module.SimpleModule;

/**
 * Exact decimals in JSON: every BigDecimal is written as a plain STRING
 * ("1.4", "550", "0.25"), never as a JSON number that JavaScript would turn
 * into an inexact floating-point value. Money still uses MoneyResponse.
 */
@Configuration
public class JacksonConfig {

    @Bean
    SimpleModule exactDecimalsModule() {
        SimpleModule module = new SimpleModule("exact-decimals");
        module.addSerializer(BigDecimal.class, new ValueSerializer<BigDecimal>() {
            @Override
            public void serialize(BigDecimal value, JsonGenerator generator, SerializationContext context) {
                generator.writeString(value.stripTrailingZeros().toPlainString());
            }
        });
        return module;
    }
}
