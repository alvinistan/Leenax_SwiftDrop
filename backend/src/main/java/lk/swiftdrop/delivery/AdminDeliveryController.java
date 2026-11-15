package lk.swiftdrop.delivery;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.delivery.CodService.CodOverview;
import lk.swiftdrop.delivery.DeliveryStaffService.CreateStaffRequest;
import lk.swiftdrop.delivery.DeliveryStaffService.PasswordRequest;
import lk.swiftdrop.delivery.DeliveryStaffService.StaffView;
import lk.swiftdrop.delivery.DeliveryStaffService.StatusRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Delivery staff accounts and cash on delivery (ADMIN only, via /api/admin/**). */
@RestController
@RequestMapping("/api/admin/delivery")
public class AdminDeliveryController {

    private final DeliveryStaffService staff;
    private final CodService cod;

    public AdminDeliveryController(DeliveryStaffService staff, CodService cod) {
        this.staff = staff;
        this.cod = cod;
    }

    public record SettleRequest(
            @NotEmpty(message = "Choose at least one order.") @Size(max = 200) List<@NotNull UUID> ids,
            /** e.g. the courier's remittance number or bank reference. */
            @Size(max = 60) String reference) {
    }

    @GetMapping("/staff")
    public ResponseEntity<List<StaffView>> staff() {
        return ResponseEntity.ok(staff.list());
    }

    @PostMapping("/staff")
    public ResponseEntity<StaffView> createStaff(@Valid @RequestBody CreateStaffRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(staff.create(request));
    }

    @PutMapping("/staff/{id}/status")
    public ResponseEntity<StaffView> setStatus(@PathVariable UUID id, @Valid @RequestBody StatusRequest request) {
        return ResponseEntity.ok(staff.setEnabled(id, request.enabled()));
    }

    @PutMapping("/staff/{id}/password")
    public ResponseEntity<StaffView> resetPassword(@PathVariable UUID id, @Valid @RequestBody PasswordRequest request) {
        return ResponseEntity.ok(staff.resetPassword(id, request.password()));
    }

    @GetMapping("/cod")
    public ResponseEntity<CodOverview> cod() {
        return ResponseEntity.ok(cod.overview());
    }

    /** The courier or staff member handed over the cash: the orders become paid. */
    @PostMapping("/cod/settle")
    public ResponseEntity<CodOverview> settle(@Valid @RequestBody SettleRequest request) {
        return ResponseEntity.ok(cod.settle(request.ids(), request.reference()));
    }
}
