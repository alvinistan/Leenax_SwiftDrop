package lk.swiftdrop.order;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lk.swiftdrop.cart.CartController;
import lk.swiftdrop.cart.CartController.CartItem;
import lk.swiftdrop.cart.LinePricing;
import lk.swiftdrop.cart.LinePricing.PricedLine;
import lk.swiftdrop.catalog.product.ProductService;
import lk.swiftdrop.catalog.product.ProductVariant;
import lk.swiftdrop.catalog.product.ProductVariantRepository;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.common.money.MoneyResponse;
import lk.swiftdrop.common.web.PageResponse;
import lk.swiftdrop.identity.User;
import lk.swiftdrop.identity.UserRepository;
import lk.swiftdrop.order.OrderDtos.AddressRequest;
import lk.swiftdrop.order.OrderDtos.AddressView;
import lk.swiftdrop.order.OrderDtos.AdminOrderDetail;
import lk.swiftdrop.order.OrderDtos.CustomerOrderDetail;
import lk.swiftdrop.order.OrderDtos.EventView;
import lk.swiftdrop.order.OrderDtos.ItemView;
import lk.swiftdrop.order.OrderDtos.OrderSummary;
import lk.swiftdrop.order.OrderDtos.PlaceOrderRequest;
import lk.swiftdrop.order.OrderDtos.ShippingView;
import lk.swiftdrop.shipping.config.ShippingConfigService;
import lk.swiftdrop.shipping.quote.QuoteDtos.QuoteItemRequest;
import lk.swiftdrop.shipping.quote.QuoteDtos.QuoteRequest;
import lk.swiftdrop.shipping.quote.QuoteOptionDraft;
import lk.swiftdrop.shipping.quote.QuoteService;
import lk.swiftdrop.shipping.quote.ShippingQuoteOption;
import lk.swiftdrop.shipping.quote.ShippingQuoteOptionRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Checkout and orders (master Phase 8). Everything is checked and priced here:
 * the browser only says what, where, which delivery option and how to pay.
 */
@Service
@Transactional(readOnly = true)
public class OrderService {

    /** The result of placing an order: {@code created} is false when an earlier identical request is returned. */
    public record PlaceResult(CustomerOrderDetail order, boolean created) {
    }

    private static final String CURRENCY = CartController.CURRENCY;

    private final OrderRepository orders;
    private final UserRepository users;
    private final ProductVariantRepository variants;
    private final ShippingQuoteOptionRepository quoteOptions;
    private final QuoteService quotes;
    private final ShippingConfigService shippingConfig;
    private final Clock clock;

    @SuppressWarnings("checkstyle:ParameterNumber")
    public OrderService(OrderRepository orders, UserRepository users, ProductVariantRepository variants,
                        ShippingQuoteOptionRepository quoteOptions, QuoteService quotes,
                        ShippingConfigService shippingConfig, Clock clock) {
        this.orders = orders;
        this.users = users;
        this.variants = variants;
        this.quoteOptions = quoteOptions;
        this.quotes = quotes;
        this.shippingConfig = shippingConfig;
        this.clock = clock;
    }

    // ---- customer ----

    @Transactional
    public PlaceResult place(String customerEmail, String idempotencyKey, PlaceOrderRequest request) {
        User customer = customer(customerEmail);
        // The same checkout sent twice (double click, network retry) returns the first order.
        var existing = orders.findByCustomerIdAndIdempotencyKey(customer.getId(), idempotencyKey);
        if (existing.isPresent()) {
            return new PlaceResult(toCustomerDetail(existing.get()), false);
        }

        List<CartItem> items = request.items();
        if (new HashSet<>(items.stream().map(CartItem::variantId).toList()).size() != items.size()) {
            throw new BadRequestException("Each product option may appear only once.");
        }
        AddressRequest a = request.address();
        String country = a.countryCode();
        boolean domestic = country.equals(shippingConfig.currentSettings().getOriginCountry());

        // 1. Products: for sale, allowed quantities (priced from the database)
        Map<UUID, ProductVariant> found = variants.findAllWithProductByIdIn(
                        items.stream().map(CartItem::variantId).toList())
                .stream().collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        List<PricedLine> lines = new ArrayList<>();
        for (CartItem item : items) {
            ProductVariant variant = found.get(item.variantId());
            if (variant == null || !LinePricing.isForSale(variant)) {
                throw new BadRequestException("An item in your cart is no longer available. Please review your cart.");
            }
            if (!variant.getQuantityRules().allows(item.quantity())) {
                throw new BadRequestException("The quantity for " + variant.getProduct().getName() + " is not allowed.");
            }
            lines.add(LinePricing.price(variant, item.quantity()));
        }

        // 2. Delivery: the chosen quote option must still be valid AND match a fresh calculation
        ShippingQuoteOption option = quoteOptions.findWithQuoteById(request.quoteOptionId())
                .orElseThrow(() -> new BadRequestException("Please get delivery prices again."));
        if (!clock.instant().isBefore(option.getQuote().getExpiresAt())) {
            throw new ConflictException("The delivery prices have expired. Please get them again.");
        }
        if (!option.getQuote().getDestinationCountry().equals(country)) {
            throw new BadRequestException("The delivery prices were for another country. Please get them again.");
        }
        QuoteOptionDraft fresh = quotes.priceForOrder(new QuoteRequest(country, a.postalCode(),
                items.stream().map(i -> new QuoteItemRequest(i.variantId(), i.quantity())).toList()),
                option.getServiceId());
        if (fresh.customerPrice().compareTo(option.getCustomerPrice()) != 0) {
            throw new ConflictException("The delivery price has changed to "
                    + MoneyResponse.of(fresh.customerPrice(), CURRENCY).amount()
                    + " LKR. Please review it and place the order again.");
        }

        // 3. Payment: COD only in Sri Lanka and only if EVERY product allows it (owner decision D-5)
        if (request.paymentMethod() == PaymentMethod.COD
                && !(domestic && lines.stream().allMatch(l -> l.variant().getProduct().isCodAllowed()))) {
            throw new BadRequestException("Cash on delivery is not available for this order.");
        }

        // 4. Stock: taken atomically, in a fixed order (by id) so two orders cannot deadlock.
        //    If any item is short, the whole transaction is rolled back (nothing is taken).
        for (PricedLine line : lines.stream().sorted(Comparator.comparing(l -> l.variant().getId())).toList()) {
            if (variants.takeStock(line.variant().getId(), line.quantity()) == 0) {
                throw new ConflictException("Sorry, there is not enough stock of "
                        + line.variant().getProduct().getName() + ". Please change the quantity.");
            }
        }

        // 5. The order with its snapshots
        List<OrderItem> orderItems = lines.stream().map(l -> new OrderItem(l.variant().getId(),
                l.variant().getProduct().getName(), LinePricing.variantLabel(l.variant()), l.variant().getSku(),
                l.variant().getSaleUnit(), l.quantity(), l.unitPrice(), l.lineTotal(), l.taxName(), l.taxPercent(),
                l.taxIncluded())).toList();
        ShippingSnapshot shipping = new ShippingSnapshot(option.getId(), fresh.serviceId(), fresh.providerCode(),
                fresh.providerName(), fresh.serviceName(), money(fresh.courierPrice()), money(fresh.platformFee()),
                fresh.markupRuleId(), fresh.markupDescription(), fresh.chargeableWeightKg());
        DeliveryAddress address = new DeliveryAddress(a.recipientName().trim(), a.phone().trim(), a.line1().trim(),
                blankToNull(a.line2()), a.city().trim(), blankToNull(a.region()), blankToNull(a.postalCode()), country);
        String number = "SD-%06d".formatted(orders.nextOrderNumber());
        CustomerOrder order = CustomerOrder.place(number, customer.getId(), idempotencyKey, request.paymentMethod(),
                CURRENCY, orderItems, shipping, money(fresh.customerPrice()), address, blankToNull(request.note()),
                customer.getEmail());
        orders.saveAndFlush(order);
        return new PlaceResult(toCustomerDetail(order), true);
    }

    public PageResponse<OrderSummary> myOrders(String customerEmail, int page, int size) {
        User customer = customer(customerEmail);
        return PageResponse.from(orders.findAllByCustomerIdOrderByCreatedAtDesc(customer.getId(),
                PageRequest.of(page, size)), OrderService::toSummary);
    }

    public CustomerOrderDetail myOrder(String customerEmail, String orderNumber) {
        return toCustomerDetail(own(customerEmail, orderNumber));
    }

    /** Customers may cancel only while the order is still PLACED (not yet confirmed). */
    @Transactional
    public CustomerOrderDetail cancelMyOrder(String customerEmail, String orderNumber) {
        CustomerOrder order = own(customerEmail, orderNumber);
        if (order.getStatus() != OrderStatus.PLACED) {
            throw new BadRequestException("This order can no longer be cancelled online. Please contact us.");
        }
        cancel(order, "Cancelled by the customer", customerEmail);
        return toCustomerDetail(order);
    }

    // ---- admin ----

    public PageResponse<OrderSummary> search(String q, OrderStatus status, int page, int size) {
        return PageResponse.from(orders.search(status, ProductService.likePattern(q),
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))), OrderService::toSummary);
    }

    public AdminOrderDetail adminGet(String orderNumber) {
        return toAdminDetail(find(orderNumber));
    }

    @Transactional
    public AdminOrderDetail changeStatus(String orderNumber, OrderStatus next, String note, String actor) {
        CustomerOrder order = find(orderNumber);
        if (next == OrderStatus.CANCELLED) {
            cancel(order, note == null ? "Cancelled by the store" : note, actor);
        } else {
            order.changeStatus(next, blankToNull(note), actor);
        }
        orders.flush();
        return toAdminDetail(order);
    }

    @Transactional
    public AdminOrderDetail markPaid(String orderNumber, String note, String actor) {
        CustomerOrder order = find(orderNumber);
        order.markPaid(blankToNull(note), actor);
        orders.flush();
        return toAdminDetail(order);
    }

    // ------------------------------------------------------------------

    /** Cancels and puts the stock back. */
    private void cancel(CustomerOrder order, String note, String actor) {
        order.changeStatus(OrderStatus.CANCELLED, note, actor);
        order.getItems().forEach(item -> variants.returnStock(item.variantId(), item.quantity()));
        orders.flush();
    }

    private User customer(String email) {
        return users.findByEmail(email).orElseThrow(() -> new ResourceNotFoundException("Customer", email));
    }

    private CustomerOrder own(String customerEmail, String orderNumber) {
        return orders.findByOrderNumberAndCustomerId(orderNumber, customer(customerEmail).getId())
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderNumber));
    }

    private CustomerOrder find(String orderNumber) {
        return orders.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderNumber));
    }

    private static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static MoneyResponse m(BigDecimal value) {
        return MoneyResponse.of(value, CURRENCY);
    }

    private static List<ItemView> items(CustomerOrder o) {
        return o.getItems().stream().map(i -> new ItemView(i.variantId(), i.productName(), i.variantLabel(), i.sku(),
                i.saleUnit(), i.quantity(), m(i.unitPrice()), m(i.lineTotal()), i.taxName(), i.taxPercent(),
                m(i.taxIncluded()))).toList();
    }

    private static CustomerOrderDetail toCustomerDetail(CustomerOrder o) {
        List<EventView> history = o.getEvents().stream()
                .map(e -> new EventView(e.getStatus(), e.getNote(), null, e.getCreatedAt())).toList();
        return new CustomerOrderDetail(o.getOrderNumber(), o.getStatus(), o.getPaymentMethod(), o.getPaymentStatus(),
                items(o), m(o.getItemsTotal()), m(o.getTaxIncluded()), m(o.getShippingPrice()), m(o.getGrandTotal()),
                o.getShipping().providerName(), o.getShipping().serviceName(), AddressView.of(o.getAddress()),
                o.getCustomerNote(), history, o.getStatus() == OrderStatus.PLACED, o.getCreatedAt());
    }

    private AdminOrderDetail toAdminDetail(CustomerOrder o) {
        User customer = users.findById(o.getCustomerId()).orElse(null);
        ShippingSnapshot s = o.getShipping();
        List<EventView> history = o.getEvents().stream()
                .map(e -> new EventView(e.getStatus(), e.getNote(), e.getActor(), e.getCreatedAt())).toList();
        return new AdminOrderDetail(o.getOrderNumber(), customer == null ? null : customer.getEmail(),
                customer == null ? null : customer.getDisplayName(), o.getStatus(), o.getStatus().allowedNext(),
                o.getPaymentMethod(), o.getPaymentStatus(), items(o), m(o.getItemsTotal()), m(o.getTaxIncluded()),
                new ShippingView(s.providerCode(), s.providerName(), s.serviceName(), m(s.courierPrice()),
                        m(s.platformFee()), m(o.getShippingPrice()), s.markupDescription(), s.chargeableWeightKg()),
                m(o.getGrandTotal()), AddressView.of(o.getAddress()), o.getCustomerNote(), history, o.getCreatedAt());
    }

    private static OrderSummary toSummary(CustomerOrder o) {
        return new OrderSummary(o.getOrderNumber(), o.getStatus(), o.getPaymentMethod(), o.getPaymentStatus(),
                m(o.getGrandTotal()), o.getItems().size(), o.getAddress().recipientName(),
                o.getAddress().countryCode(), o.getCreatedAt());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
