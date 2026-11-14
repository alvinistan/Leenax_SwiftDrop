package lk.swiftdrop.shipping.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.catalog.product.ShippingCategory;
import lk.swiftdrop.common.web.PageResponse;
import lk.swiftdrop.shipping.audit.ShippingAuditLog;
import lk.swiftdrop.shipping.audit.ShippingAuditLogRepository;
import lk.swiftdrop.shipping.config.Countries;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.CategoryPolicyRequest;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.CategoryPolicyResponse;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.PresetRequest;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.PresetResponse;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.ProviderResponse;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.ProviderUpdateRequest;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.SettingsRequest;
import lk.swiftdrop.shipping.config.ShippingConfigDtos.SettingsResponse;
import lk.swiftdrop.shipping.config.ShippingConfigService;
import lk.swiftdrop.shipping.pricing.MarkupRuleService;
import lk.swiftdrop.shipping.pricing.RateCardService;
import lk.swiftdrop.shipping.pricing.ShippingPricingDtos.MarkupRuleRequest;
import lk.swiftdrop.shipping.pricing.ShippingPricingDtos.MarkupRuleResponse;
import lk.swiftdrop.shipping.pricing.ShippingPricingDtos.RateCardRequest;
import lk.swiftdrop.shipping.pricing.ShippingPricingDtos.RateCardResponse;
import lk.swiftdrop.shipping.quote.QuoteDtos.AdminQuoteResponse;
import lk.swiftdrop.shipping.quote.QuoteDtos.QuoteRequest;
import lk.swiftdrop.shipping.quote.QuoteService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * Shipping administration (ADMIN only: SecurityConfig protects /api/admin/**).
 * Courier credentials never pass through here; there are none stored yet.
 */
@RestController
@Validated
@RequestMapping("/api/admin/shipping")
public class AdminShippingController {

    public record AuditEntryResponse(UUID id, String entityType, String entityId, String action, String actor,
                                     String beforeJson, String afterJson, Instant createdAt) {

        static AuditEntryResponse from(ShippingAuditLog log) {
            return new AuditEntryResponse(log.getId(), log.getEntityType(), log.getEntityId(), log.getAction(),
                    log.getActor(), log.getBeforeJson(), log.getAfterJson(), log.getCreatedAt());
        }
    }

    private final ShippingConfigService config;
    private final MarkupRuleService markupRules;
    private final RateCardService rateCards;
    private final QuoteService quotes;
    private final ShippingAuditLogRepository auditLog;

    public AdminShippingController(ShippingConfigService config, MarkupRuleService markupRules,
                                   RateCardService rateCards, QuoteService quotes,
                                   ShippingAuditLogRepository auditLog) {
        this.config = config;
        this.markupRules = markupRules;
        this.rateCards = rateCards;
        this.quotes = quotes;
        this.auditLog = auditLog;
    }

    // ---- settings ----

    @GetMapping("/settings")
    public ResponseEntity<SettingsResponse> settings() {
        return ResponseEntity.ok(config.getSettings());
    }

    @PutMapping("/settings")
    public ResponseEntity<SettingsResponse> updateSettings(@Valid @RequestBody SettingsRequest request) {
        return ResponseEntity.ok(config.updateSettings(request));
    }

    @GetMapping("/countries")
    public ResponseEntity<List<Countries.Country>> countries() {
        return ResponseEntity.ok(Countries.all());
    }

    // ---- couriers ----

    @GetMapping("/providers")
    public ResponseEntity<List<ProviderResponse>> providers() {
        return ResponseEntity.ok(config.listProviders());
    }

    @PutMapping("/providers/{id}")
    public ResponseEntity<ProviderResponse> updateProvider(@PathVariable UUID id,
                                                           @Valid @RequestBody ProviderUpdateRequest request) {
        return ResponseEntity.ok(config.updateProvider(id, request));
    }

    // ---- boxes ----

    @GetMapping("/presets")
    public ResponseEntity<List<PresetResponse>> presets() {
        return ResponseEntity.ok(config.listPresets());
    }

    @PostMapping("/presets")
    public ResponseEntity<PresetResponse> createPreset(@Valid @RequestBody PresetRequest request) {
        PresetResponse created = config.createPreset(request);
        return ResponseEntity.created(location(created.id())).body(created);
    }

    @PutMapping("/presets/{id}")
    public ResponseEntity<PresetResponse> updatePreset(@PathVariable UUID id, @Valid @RequestBody PresetRequest request) {
        return ResponseEntity.ok(config.updatePreset(id, request));
    }

    @DeleteMapping("/presets/{id}")
    public ResponseEntity<Void> deletePreset(@PathVariable UUID id) {
        config.deletePreset(id);
        return ResponseEntity.noContent().build();
    }

    // ---- country restrictions ----

    @GetMapping("/category-policies")
    public ResponseEntity<List<CategoryPolicyResponse>> categoryPolicies() {
        return ResponseEntity.ok(config.listCategoryPolicies());
    }

    @PutMapping("/category-policies/{category}")
    public ResponseEntity<CategoryPolicyResponse> updateCategoryPolicy(@PathVariable ShippingCategory category,
                                                                       @Valid @RequestBody CategoryPolicyRequest request) {
        return ResponseEntity.ok(config.updateCategoryPolicy(category, request));
    }

    // ---- platform fee ----

    @GetMapping("/markup-rules")
    public ResponseEntity<List<MarkupRuleResponse>> markupRules() {
        return ResponseEntity.ok(markupRules.list());
    }

    @PostMapping("/markup-rules")
    public ResponseEntity<MarkupRuleResponse> createMarkupRule(@Valid @RequestBody MarkupRuleRequest request) {
        MarkupRuleResponse created = markupRules.create(request);
        return ResponseEntity.created(location(created.id())).body(created);
    }

    @PutMapping("/markup-rules/{id}")
    public ResponseEntity<MarkupRuleResponse> updateMarkupRule(@PathVariable UUID id,
                                                               @Valid @RequestBody MarkupRuleRequest request) {
        return ResponseEntity.ok(markupRules.update(id, request));
    }

    @DeleteMapping("/markup-rules/{id}")
    public ResponseEntity<Void> deleteMarkupRule(@PathVariable UUID id) {
        markupRules.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ---- rate cards ----

    @GetMapping("/rate-cards")
    public ResponseEntity<List<RateCardResponse>> rateCards() {
        return ResponseEntity.ok(rateCards.list());
    }

    @GetMapping("/rate-cards/{id}")
    public ResponseEntity<RateCardResponse> rateCard(@PathVariable UUID id) {
        return ResponseEntity.ok(rateCards.get(id));
    }

    @PostMapping("/rate-cards")
    public ResponseEntity<RateCardResponse> createRateCard(@Valid @RequestBody RateCardRequest request) {
        RateCardResponse created = rateCards.create(request);
        return ResponseEntity.created(location(created.id())).body(created);
    }

    @PutMapping("/rate-cards/{id}")
    public ResponseEntity<RateCardResponse> updateRateCard(@PathVariable UUID id,
                                                           @Valid @RequestBody RateCardRequest request) {
        return ResponseEntity.ok(rateCards.update(id, request));
    }

    @DeleteMapping("/rate-cards/{id}")
    public ResponseEntity<Void> deleteRateCard(@PathVariable UUID id) {
        rateCards.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ---- simulator and history ----

    @PostMapping("/quotes/simulate")
    public ResponseEntity<AdminQuoteResponse> simulate(@Valid @RequestBody QuoteRequest request) {
        return ResponseEntity.ok(quotes.simulate(request));
    }

    @GetMapping("/audit")
    public ResponseEntity<PageResponse<AuditEntryResponse>> audit(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) @Pattern(regexp = "^[A-Z_]{1,40}$") String entityType) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<ShippingAuditLog> result = entityType == null
                ? auditLog.findAllByOrderByCreatedAtDesc(pageable)
                : auditLog.findAllByEntityTypeOrderByCreatedAtDesc(entityType, pageable);
        return ResponseEntity.ok(PageResponse.from(result, AuditEntryResponse::from));
    }

    private static URI location(UUID id) {
        return ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(id).toUri();
    }
}
