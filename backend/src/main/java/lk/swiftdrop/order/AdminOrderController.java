package lk.swiftdrop.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lk.swiftdrop.common.web.PageResponse;
import lk.swiftdrop.order.OrderDtos.AdminOrderDetail;
import lk.swiftdrop.order.OrderDtos.OrderSummary;
import lk.swiftdrop.order.OrderDtos.PaymentRequest;
import lk.swiftdrop.order.OrderDtos.StatusChangeRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Order management for the owner (ADMIN only, via /api/admin/**). */
@RestController
@Validated
@RequestMapping("/api/admin/orders")
public class AdminOrderController {

    private final OrderService orders;

    public AdminOrderController(OrderService orders) {
        this.orders = orders;
    }

    /** GET ?q=order-number-or-name&status=PLACED&page=0&size=20, newest first. */
    @GetMapping
    public ResponseEntity<PageResponse<OrderSummary>> search(
            @RequestParam(required = false) @Size(max = 60) String q,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return ResponseEntity.ok(orders.search(q, status, page, size));
    }

    @GetMapping("/{orderNumber}")
    public ResponseEntity<AdminOrderDetail> get(@PathVariable String orderNumber) {
        return ResponseEntity.ok(orders.adminGet(orderNumber));
    }

    @PostMapping("/{orderNumber}/status")
    public ResponseEntity<AdminOrderDetail> changeStatus(@AuthenticationPrincipal UserDetails user,
                                                         @PathVariable String orderNumber,
                                                         @Valid @RequestBody StatusChangeRequest request) {
        return ResponseEntity.ok(orders.changeStatus(orderNumber, request.status(), request.note(), user.getUsername()));
    }

    @PostMapping("/{orderNumber}/payment")
    public ResponseEntity<AdminOrderDetail> markPaid(@AuthenticationPrincipal UserDetails user,
                                                     @PathVariable String orderNumber,
                                                     @Valid @RequestBody PaymentRequest request) {
        return ResponseEntity.ok(orders.markPaid(orderNumber, request.note(), user.getUsername()));
    }
}
