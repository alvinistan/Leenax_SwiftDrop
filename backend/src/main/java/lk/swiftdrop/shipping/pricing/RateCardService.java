package lk.swiftdrop.shipping.pricing;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.shipping.audit.ShippingAuditService;
import lk.swiftdrop.shipping.audit.ShippingAuditService.Action;
import lk.swiftdrop.shipping.config.Countries;
import lk.swiftdrop.shipping.config.CourierServiceConfig;
import lk.swiftdrop.shipping.config.CourierServiceRepository;
import lk.swiftdrop.shipping.pricing.ShippingPricingDtos.RateBandDto;
import lk.swiftdrop.shipping.pricing.ShippingPricingDtos.RateCardRequest;
import lk.swiftdrop.shipping.pricing.ShippingPricingDtos.RateCardResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Courier price lists, typed in by the admin. No prices are invented by the system. */
@Service
@Transactional(readOnly = true)
public class RateCardService {

    private final RateCardRepository cards;
    private final CourierServiceRepository services;
    private final ShippingAuditService audit;

    public RateCardService(RateCardRepository cards, CourierServiceRepository services, ShippingAuditService audit) {
        this.cards = cards;
        this.services = services;
        this.audit = audit;
    }

    public List<RateCardResponse> list() {
        return cards.findAllByOrderByCountryCodeAsc().stream().map(RateCardResponse::from).toList();
    }

    public RateCardResponse get(UUID id) {
        return RateCardResponse.from(find(id));
    }

    @Transactional
    public RateCardResponse create(RateCardRequest r) {
        CourierServiceConfig service = validate(r);
        if (cards.existsByServiceIdAndCountryCode(r.serviceId(), r.countryCode())) {
            throw new ConflictException("This courier service already has a rate card for " + r.countryCode() + ".");
        }
        RateCard card = new RateCard(service);
        card.update(service, r.countryCode(), r.enabled(), toBands(r.bands()));
        cards.save(card);
        RateCardResponse after = RateCardResponse.from(card);
        audit.record("RATE_CARD", card.getId(), Action.CREATE, null, after);
        return after;
    }

    @Transactional
    public RateCardResponse update(UUID id, RateCardRequest r) {
        RateCard card = find(id);
        CourierServiceConfig service = validate(r);
        if (cards.existsByServiceIdAndCountryCodeAndIdNot(r.serviceId(), r.countryCode(), id)) {
            throw new ConflictException("This courier service already has a rate card for " + r.countryCode() + ".");
        }
        RateCardResponse before = RateCardResponse.from(card);
        card.update(service, r.countryCode(), r.enabled(), toBands(r.bands()));
        RateCardResponse after = RateCardResponse.from(card);
        audit.record("RATE_CARD", id, Action.UPDATE, before, after);
        return after;
    }

    @Transactional
    public void delete(UUID id) {
        RateCard card = find(id);
        audit.record("RATE_CARD", id, Action.DELETE, RateCardResponse.from(card), null);
        cards.delete(card);
    }

    private RateCard find(UUID id) {
        return cards.findById(id).orElseThrow(() -> new ResourceNotFoundException("Rate card", id));
    }

    private CourierServiceConfig validate(RateCardRequest r) {
        if (!Countries.isValid(r.countryCode())) {
            throw new BadRequestException("Unknown country code: " + r.countryCode());
        }
        BigDecimal previous = BigDecimal.ZERO;
        for (RateBandDto band : r.bands()) {
            if (band.maxWeightKg().compareTo(previous) <= 0) {
                throw new BadRequestException("Weight bands must go up: each 'up to' weight must be more than the one before.");
            }
            previous = band.maxWeightKg();
        }
        return services.findById(r.serviceId())
                .orElseThrow(() -> new BadRequestException("Unknown courier service."));
    }

    private static List<RateBand> toBands(List<RateBandDto> bands) {
        return bands.stream().map(b -> new RateBand(b.maxWeightKg(), b.price())).toList();
    }
}
