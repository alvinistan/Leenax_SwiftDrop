package lk.swiftdrop.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.net.URI;
import lk.swiftdrop.common.web.PageResponse;
import lk.swiftdrop.order.OrderDtos.CustomerOrderDetail;
import lk.swiftdrop.order.OrderDtos.OrderSummary;
import lk.swiftdrop.order.OrderDtos.PlaceOrderRequest;
import lk.swiftdrop.order.OrderService.PlaceResult;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/** A logged-in customer's checkout and own orders (SecurityConfig: CUSTOMER role). */
@RestController
@Validated
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orders;

    public OrderController(OrderService orders) {
        this.orders = orders;
    }

    /**
     * Places an order. The Idempotency-Key header (a random id the page creates
     * once per checkout) makes a repeated submit return the SAME order:
     * 201 the first time, 200 afterwards.
     */
    @PostMapping
    public ResponseEntity<CustomerOrderDetail> place(
            @AuthenticationPrincipal UserDetails user,
            @RequestHeader("Idempotency-Key")
            @Pattern(regexp = "^[A-Za-z0-9-]{8,64}$", message = "Invalid Idempotency-Key.") String idempotencyKey,
            @Valid @RequestBody PlaceOrderRequest request) {
        PlaceResult result = orders.place(user.getUsername(), idempotencyKey, request);
        if (!result.created()) {
            return ResponseEntity.ok(result.order());
        }
        URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{number}")
                .buildAndExpand(result.order().orderNumber()).toUri();
        return ResponseEntity.created(location).body(result.order());
    }

    @GetMapping
    public ResponseEntity<PageResponse<OrderSummary>> mine(
            @AuthenticationPrincipal UserDetails user,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size) {
        return ResponseEntity.ok(orders.myOrders(user.getUsername(), page, size));
    }

    @GetMapping("/{orderNumber}")
    public ResponseEntity<CustomerOrderDetail> get(@AuthenticationPrincipal UserDetails user,
                                                   @PathVariable String orderNumber) {
        return ResponseEntity.ok(orders.myOrder(user.getUsername(), orderNumber));
    }

    @PostMapping("/{orderNumber}/cancel")
    public ResponseEntity<CustomerOrderDetail> cancel(@AuthenticationPrincipal UserDetails user,
                                                      @PathVariable String orderNumber) {
        return ResponseEntity.ok(orders.cancelMyOrder(user.getUsername(), orderNumber));
    }
}
