package lk.swiftdrop.shipping.pricing;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.shipping.audit.ShippingAuditService;
import lk.swiftdrop.shipping.audit.ShippingAuditService.Action;
import lk.swiftdrop.shipping.config.Countries;
import lk.swiftdrop.shipping.config.CourierProviderRepository;
import lk.swiftdrop.shipping.pricing.ShippingPricingDtos.MarkupRuleRequest;
import lk.swiftdrop.shipping.pricing.ShippingPricingDtos.MarkupRuleResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Platform-fee rules. Rules are never edited silently: every change is in the audit log. */
@Service
@Transactional(readOnly = true)
public class MarkupRuleService {

    private final MarkupRuleRepository rules;
    private final CourierProviderRepository providers;
    private final ShippingAuditService audit;
    private final Clock clock;

    public MarkupRuleService(MarkupRuleRepository rules, CourierProviderRepository providers,
                             ShippingAuditService audit, Clock clock) {
        this.rules = rules;
        this.providers = providers;
        this.audit = audit;
        this.clock = clock;
    }

    public List<MarkupRuleResponse> list() {
        Instant now = clock.instant();
        return rules.findAllByOrderByCreatedAtAsc().stream().map(r -> MarkupRuleResponse.from(r, now)).toList();
    }

    @Transactional
    public MarkupRuleResponse create(MarkupRuleRequest r) {
        MarkupRule rule = new MarkupRule(r.name().trim());
        apply(rule, r);
        rules.save(rule);
        MarkupRuleResponse after = MarkupRuleResponse.from(rule, clock.instant());
        audit.record("MARKUP_RULE", rule.getId(), Action.CREATE, null, after);
        return after;
    }

    @Transactional
    public MarkupRuleResponse update(UUID id, MarkupRuleRequest r) {
        MarkupRule rule = find(id);
        Instant now = clock.instant();
        MarkupRuleResponse before = MarkupRuleResponse.from(rule, now);
        apply(rule, r);
        MarkupRuleResponse after = MarkupRuleResponse.from(rule, now);
        audit.record("MARKUP_RULE", id, Action.UPDATE, before, after);
        return after;
    }

    @Transactional
    public void delete(UUID id) {
        MarkupRule rule = find(id);
        audit.record("MARKUP_RULE", id, Action.DELETE, MarkupRuleResponse.from(rule, clock.instant()), null);
        rules.delete(rule);
    }

    private MarkupRule find(UUID id) {
        return rules.findById(id).orElseThrow(() -> new ResourceNotFoundException("Platform fee rule", id));
    }

    private void apply(MarkupRule rule, MarkupRuleRequest r) {
        if (r.type() != MarkupType.FIXED && r.percent() == null) {
            throw new BadRequestException("Enter the percent for this fee type.");
        }
        if (r.type() != MarkupType.PERCENT && r.fixedAmount() == null) {
            throw new BadRequestException("Enter the fixed amount for this fee type.");
        }
        if (r.minFee() != null && r.maxFee() != null && r.maxFee().compareTo(r.minFee()) < 0) {
            throw new BadRequestException("The maximum fee must not be less than the minimum fee.");
        }
        Instant from = r.effectiveFrom() != null ? r.effectiveFrom() : clock.instant();
        if (r.effectiveTo() != null && !r.effectiveTo().isAfter(from)) {
            throw new BadRequestException("The end date must be after the start date.");
        }
        if (r.providerId() != null && !providers.existsById(r.providerId())) {
            throw new BadRequestException("Unknown courier.");
        }
        if (r.countryCode() != null && !Countries.isValid(r.countryCode())) {
            throw new BadRequestException("Unknown country code: " + r.countryCode());
        }
        rule.update(r.name().trim(), r.type(), r.percent(), r.fixedAmount(), r.minFee(), r.maxFee(), r.providerId(),
                r.countryCode(), from, r.effectiveTo(), r.enabled(), r.priority());
    }
}
