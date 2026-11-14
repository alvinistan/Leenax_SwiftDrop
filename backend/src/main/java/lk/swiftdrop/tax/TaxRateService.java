package lk.swiftdrop.tax;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.shipping.audit.ShippingAuditService;
import lk.swiftdrop.shipping.audit.ShippingAuditService.Action;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Tax rates the admin can pick per product. */
@Service
@Transactional(readOnly = true)
public class TaxRateService {

    public record TaxRateRequest(
            @NotBlank(message = "Name is required.") @Size(max = 60) String name,
            @NotNull(message = "Percent is required.")
            @DecimalMin(value = "0", message = "Percent cannot be negative.")
            @DecimalMax(value = "100", message = "Percent cannot be more than 100.")
            @Digits(integer = 3, fraction = 2, message = "At most 2 decimal places.") BigDecimal percent) {
    }

    public record TaxRateResponse(UUID id, String name, BigDecimal percent, long productCount) {
    }

    private final TaxRateRepository rates;
    private final ShippingAuditService audit;

    public TaxRateService(TaxRateRepository rates, ShippingAuditService audit) {
        this.rates = rates;
        this.audit = audit;
    }

    /** What the change history keeps (prices depend on it, so every change is recorded). */
    record AuditView(String name, BigDecimal percent) {
        static AuditView of(TaxRate r) {
            return new AuditView(r.getName(), r.getPercent());
        }
    }

    public List<TaxRateResponse> list() {
        return rates.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public TaxRateResponse create(TaxRateRequest r) {
        if (rates.existsByNameIgnoreCase(r.name().trim())) {
            throw new ConflictException("A tax rate named '" + r.name().trim() + "' already exists.");
        }
        TaxRate rate = rates.save(new TaxRate(r.name().trim(), r.percent()));
        audit.record("TAX_RATE", rate.getId(), Action.CREATE, null, AuditView.of(rate));
        return toResponse(rate);
    }

    /** Changing a rate affects NEW orders only: placed orders keep their tax snapshot. */
    @Transactional
    public TaxRateResponse update(UUID id, TaxRateRequest r) {
        TaxRate rate = find(id);
        if (rates.existsByNameIgnoreCaseAndIdNot(r.name().trim(), id)) {
            throw new ConflictException("A tax rate named '" + r.name().trim() + "' already exists.");
        }
        AuditView before = AuditView.of(rate);
        rate.update(r.name().trim(), r.percent());
        audit.record("TAX_RATE", id, Action.UPDATE, before, AuditView.of(rate));
        return toResponse(rate);
    }

    @Transactional
    public void delete(UUID id) {
        TaxRate rate = find(id);
        long used = rates.countProductsUsing(id);
        if (used > 0) {
            throw new ConflictException("This tax rate is used by " + used + " product(s). Choose another rate for them first.");
        }
        audit.record("TAX_RATE", id, Action.DELETE, AuditView.of(rate), null);
        rates.delete(rate);
    }

    public TaxRate find(UUID id) {
        return rates.findById(id).orElseThrow(() -> new ResourceNotFoundException("Tax rate", id));
    }

    private TaxRateResponse toResponse(TaxRate rate) {
        return new TaxRateResponse(rate.getId(), rate.getName(), rate.getPercent(), rates.countProductsUsing(rate.getId()));
    }
}
