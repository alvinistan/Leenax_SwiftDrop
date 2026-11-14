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

    public TaxRateService(TaxRateRepository rates) {
        this.rates = rates;
    }

    public List<TaxRateResponse> list() {
        return rates.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public TaxRateResponse create(TaxRateRequest r) {
        if (rates.existsByNameIgnoreCase(r.name().trim())) {
            throw new ConflictException("A tax rate named '" + r.name().trim() + "' already exists.");
        }
        return toResponse(rates.save(new TaxRate(r.name().trim(), r.percent())));
    }

    /** Changing a rate affects NEW orders only: placed orders keep their tax snapshot. */
    @Transactional
    public TaxRateResponse update(UUID id, TaxRateRequest r) {
        TaxRate rate = find(id);
        if (rates.existsByNameIgnoreCaseAndIdNot(r.name().trim(), id)) {
            throw new ConflictException("A tax rate named '" + r.name().trim() + "' already exists.");
        }
        rate.update(r.name().trim(), r.percent());
        return toResponse(rate);
    }

    @Transactional
    public void delete(UUID id) {
        TaxRate rate = find(id);
        long used = rates.countProductsUsing(id);
        if (used > 0) {
            throw new ConflictException("This tax rate is used by " + used + " product(s). Choose another rate for them first.");
        }
        rates.delete(rate);
    }

    public TaxRate find(UUID id) {
        return rates.findById(id).orElseThrow(() -> new ResourceNotFoundException("Tax rate", id));
    }

    private TaxRateResponse toResponse(TaxRate rate) {
        return new TaxRateResponse(rate.getId(), rate.getName(), rate.getPercent(), rates.countProductsUsing(rate.getId()));
    }
}
