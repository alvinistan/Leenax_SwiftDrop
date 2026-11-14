package lk.swiftdrop.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lk.swiftdrop.cart.CartController.CartItem;
import lk.swiftdrop.catalog.product.SaleUnit;
import lk.swiftdrop.common.money.MoneyResponse;

/** Order shapes. The request has NO prices: everything is priced on the server. */
public final class OrderDtos {

    private OrderDtos() {
    }

    public record AddressRequest(
            @NotBlank(message = "Recipient name is required.") @Size(max = 100) String recipientName,
            @NotBlank(message = "Phone number is required.")
            @Pattern(regexp = "^\\+?[0-9 ()-]{7,30}$", message = "Enter a phone number like +94 77 123 4567.")
            String phone,
            @NotBlank(message = "Address is required.") @Size(max = 150) String line1,
            @Size(max = 150) String line2,
            @NotBlank(message = "City is required.") @Size(max = 100) String city,
            @Size(max = 100) String region,
            @Size(max = 20) String postalCode,
            @NotNull(message = "Choose a country.")
            @Pattern(regexp = "^[A-Z]{2}$", message = "Use a two-letter country code.") String countryCode) {
    }

    public record PlaceOrderRequest(
            @NotEmpty(message = "Your cart is empty.") @Size(max = 50) List<@Valid @NotNull CartItem> items,
            @NotNull @Valid AddressRequest address,
            @NotNull(message = "Choose a delivery option.") UUID quoteOptionId,
            @NotNull(message = "Choose how you will pay.") PaymentMethod paymentMethod,
            @Size(max = 500) String note) {
    }

    public record StatusChangeRequest(@NotNull OrderStatus status, @Size(max = 300) String note) {
    }

    public record PaymentRequest(@Size(max = 300) String note) {
    }

    public record ItemView(UUID variantId, String productName, String variantLabel, String sku, SaleUnit saleUnit,
                           BigDecimal quantity, MoneyResponse unitPrice, MoneyResponse lineTotal, String taxName,
                           BigDecimal taxPercent, MoneyResponse taxIncluded) {
    }

    public record AddressView(String recipientName, String phone, String line1, String line2, String city,
                              String region, String postalCode, String countryCode) {

        static AddressView of(DeliveryAddress a) {
            return new AddressView(a.recipientName(), a.phone(), a.line1(), a.line2(), a.city(), a.region(),
                    a.postalCode(), a.countryCode());
        }
    }

    public record EventView(String status, String note, String actor, Instant at) {
    }

    /** A tracking step as the customer sees it (no internal notes or staff names). */
    public record TrackingStepView(String status, Instant at, String location) {
    }

    /** A parcel of this order. */
    public record ShipmentView(UUID id, String providerName, String serviceName, String awb, String status,
                               String trackingUrl, List<TrackingStepView> steps) {
    }

    /** What the customer sees: no courier cost, no platform fee, no staff names. */
    public record CustomerOrderDetail(String orderNumber, OrderStatus status, PaymentMethod paymentMethod,
                                      CustomerOrder.PaymentStatus paymentStatus, List<ItemView> items,
                                      MoneyResponse itemsTotal, MoneyResponse taxIncluded,
                                      MoneyResponse shippingPrice, MoneyResponse grandTotal,
                                      String deliveryProvider, String deliveryService, AddressView address,
                                      String note, List<EventView> history, boolean canCancel,
                                      Instant createdAt, List<ShipmentView> shipments) {
    }

    public record ShippingView(String providerCode, String providerName, String serviceName,
                               MoneyResponse courierPrice, MoneyResponse platformFee, MoneyResponse customerPrice,
                               String markupDescription, BigDecimal chargeableWeightKg) {
    }

    public record AdminOrderDetail(String orderNumber, String customerEmail, String customerName,
                                   OrderStatus status, Set<OrderStatus> allowedNextStatuses,
                                   PaymentMethod paymentMethod, CustomerOrder.PaymentStatus paymentStatus,
                                   List<ItemView> items, MoneyResponse itemsTotal, MoneyResponse taxIncluded,
                                   ShippingView shipping, MoneyResponse grandTotal, AddressView address, String note,
                                   List<EventView> history, Instant createdAt, List<ShipmentView> shipments) {
    }

    public record OrderSummary(String orderNumber, OrderStatus status, PaymentMethod paymentMethod,
                               CustomerOrder.PaymentStatus paymentStatus, MoneyResponse grandTotal, int itemCount,
                               String recipientName, String countryCode, Instant createdAt) {
    }
}
