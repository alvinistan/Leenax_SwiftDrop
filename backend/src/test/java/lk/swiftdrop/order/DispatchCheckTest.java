package lk.swiftdrop.order;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import lk.swiftdrop.order.CustomerOrder.PaymentStatus;
import lk.swiftdrop.order.DispatchCheck.ProductFacts;
import lk.swiftdrop.order.DispatchCheck.Result;
import org.junit.jupiter.api.Test;

class DispatchCheckTest {

    private static final List<ProductFacts> READY_PRODUCTS = List.of(new ProductFacts("Rich cake", true, true));

    @Test
    void cashOnDeliveryShipsWithoutPaymentFirst() {
        Result r = DispatchCheck.evaluate(OrderStatus.CONFIRMED, PaymentMethod.COD, PaymentStatus.UNPAID, true,
                READY_PRODUCTS);
        assertThat(r.ready()).isTrue();
        assertThat(r.blockers()).isEmpty();
    }

    @Test
    void arrangedPaymentMustArriveFirstButTheOwnerMayOverride() {
        Result unpaid = DispatchCheck.evaluate(OrderStatus.CONFIRMED, PaymentMethod.ARRANGE_LATER, PaymentStatus.UNPAID,
                true, READY_PRODUCTS);
        assertThat(unpaid.ready()).isFalse();
        assertThat(unpaid.paymentOverridable()).isTrue();

        Result paid = DispatchCheck.evaluate(OrderStatus.CONFIRMED, PaymentMethod.ARRANGE_LATER, PaymentStatus.PAID,
                true, READY_PRODUCTS);
        assertThat(paid.ready()).isTrue();
    }

    @Test
    void placedOrdersAreNeverShipped() {
        Result r = DispatchCheck.evaluate(OrderStatus.PLACED, PaymentMethod.COD, PaymentStatus.UNPAID, true,
                READY_PRODUCTS);
        assertThat(r.ready()).isFalse();
        assertThat(r.blockers()).containsExactly("Confirm the order first.");
        assertThat(r.paymentOverridable()).isFalse();
    }

    @Test
    void internationalParcelsNeedCustomsDetails() {
        List<ProductFacts> products = List.of(new ProductFacts("Dried fish", false, true),
                new ProductFacts("Rich cake", true, true));
        Result abroad = DispatchCheck.evaluate(OrderStatus.CONFIRMED, PaymentMethod.ARRANGE_LATER, PaymentStatus.UNPAID,
                false, products);
        assertThat(abroad.blockers()).hasSize(2).anyMatch(b -> b.contains("Dried fish"));
        // Two problems: the payment override alone is not enough
        assertThat(abroad.paymentOverridable()).isFalse();

        Result home = DispatchCheck.evaluate(OrderStatus.CONFIRMED, PaymentMethod.COD, PaymentStatus.UNPAID, true,
                products);
        assertThat(home.ready()).isTrue(); // customs details are not needed within Sri Lanka
    }

    @Test
    void changedCountryRulesOnlyWarn() {
        Result r = DispatchCheck.evaluate(OrderStatus.CONFIRMED, PaymentMethod.COD, PaymentStatus.UNPAID, true,
                List.of(new ProductFacts("Dried fish", true, false)));
        assertThat(r.ready()).isTrue();
        assertThat(r.warnings()).singleElement().asString().contains("now blocked");
    }
}
