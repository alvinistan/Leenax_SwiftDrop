package lk.swiftdrop.delivery;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.identity.Role;
import lk.swiftdrop.identity.User;
import lk.swiftdrop.identity.UserRepository;
import lk.swiftdrop.shipping.audit.ShippingAuditService;
import lk.swiftdrop.shipping.audit.ShippingAuditService.Action;
import lk.swiftdrop.shipping.shipment.ShipmentRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The owner's delivery staff accounts (role DELIVERY). Passwords are only ever
 * stored as a hash and never appear in the change history.
 */
@Service
@Transactional(readOnly = true)
public class DeliveryStaffService {

    static final int MIN_PASSWORD = 12;

    private final UserRepository users;
    private final ShipmentRepository shipments;
    private final PasswordEncoder passwordEncoder;
    private final ShippingAuditService audit;

    public DeliveryStaffService(UserRepository users, ShipmentRepository shipments, PasswordEncoder passwordEncoder,
                                ShippingAuditService audit) {
        this.users = users;
        this.shipments = shipments;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
    }

    public record CreateStaffRequest(
            @NotBlank(message = "Name is required.") @Size(max = 100) String displayName,
            @NotBlank(message = "Email is required.")
            @Email(message = "Enter an email address like name@example.com.") @Size(max = 254) String email,
            @NotBlank(message = "Password is required.")
            @Size(min = MIN_PASSWORD, max = 128, message = "Use a password of 12 to 128 characters.") String password) {
    }

    public record StatusRequest(@NotNull Boolean enabled) {
    }

    public record PasswordRequest(
            @NotBlank(message = "Password is required.")
            @Size(min = MIN_PASSWORD, max = 128, message = "Use a password of 12 to 128 characters.") String password) {
    }

    public record StaffView(UUID id, String displayName, String email, boolean enabled, long activeDeliveries,
                            Instant createdAt) {
    }

    /** What the change history stores: never a password or its hash. */
    record AuditView(String email, String displayName, boolean enabled, String change) {
    }

    public List<StaffView> list() {
        return users.findAllByRole(Role.DELIVERY).stream().map(this::view).toList();
    }

    @Transactional
    public StaffView create(CreateStaffRequest r) {
        String email = User.normalizeEmail(r.email());
        if (users.findByEmail(email).isPresent()) {
            // Never turn an existing (customer) account into a staff account by accident.
            throw new ConflictException("An account with this email already exists. Use a different email for staff.");
        }
        User staff = users.save(new User(email, passwordEncoder.encode(r.password()), r.displayName().trim(),
                EnumSet.of(Role.DELIVERY)));
        audit.record("DELIVERY_STAFF", staff.getId(), Action.CREATE, null,
                new AuditView(email, staff.getDisplayName(), true, "Account created"));
        return view(staff);
    }

    @Transactional
    public StaffView setEnabled(UUID id, boolean enabled) {
        User staff = find(id);
        if (!enabled && shipments.countActiveAssignedTo(id) > 0) {
            throw new BadRequestException(staff.getDisplayName() + " still has deliveries. Give them to someone else first.");
        }
        if (staff.isEnabled() != enabled) {
            AuditView before = new AuditView(staff.getEmail(), staff.getDisplayName(), staff.isEnabled(), null);
            staff.setEnabled(enabled);
            audit.record("DELIVERY_STAFF", id, Action.UPDATE, before,
                    new AuditView(staff.getEmail(), staff.getDisplayName(), enabled, enabled ? "Enabled" : "Disabled"));
        }
        return view(staff);
    }

    @Transactional
    public StaffView resetPassword(UUID id, String password) {
        User staff = find(id);
        staff.changePasswordHash(passwordEncoder.encode(password));
        audit.record("DELIVERY_STAFF", id, Action.UPDATE, null,
                new AuditView(staff.getEmail(), staff.getDisplayName(), staff.isEnabled(), "Password changed"));
        return view(staff);
    }

    /** Only delivery staff can be managed here (not admins or customers). */
    private User find(UUID id) {
        return users.findById(id).filter(u -> u.hasRole(Role.DELIVERY))
                .orElseThrow(() -> new ResourceNotFoundException("Delivery staff member", id));
    }

    private StaffView view(User u) {
        return new StaffView(u.getId(), u.getDisplayName(), u.getEmail(), u.isEnabled(),
                shipments.countActiveAssignedTo(u.getId()), u.getCreatedAt());
    }
}
