package lk.swiftdrop.shipping.quote;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lk.swiftdrop.catalog.product.Product;
import lk.swiftdrop.catalog.product.ProductStatus;
import lk.swiftdrop.catalog.product.ProductVariant;
import lk.swiftdrop.catalog.product.ProductVariantRepository;
import lk.swiftdrop.catalog.product.ShippingCategory;
import lk.swiftdrop.common.error.BadRequestException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.common.money.MoneyResponse;
import lk.swiftdrop.shipping.config.Countries;
import lk.swiftdrop.shipping.config.CourierProviderConfig;
import lk.swiftdrop.shipping.config.CourierProviderRepository;
import lk.swiftdrop.shipping.config.CourierServiceConfig;
import lk.swiftdrop.shipping.config.PackagePreset;
import lk.swiftdrop.shipping.config.PackagePresetRepository;
import lk.swiftdrop.shipping.config.RatesSource;
import lk.swiftdrop.shipping.config.ServiceScope;
import lk.swiftdrop.shipping.config.ShippingCategoryPolicy;
import lk.swiftdrop.shipping.config.ShippingCategoryPolicyRepository;
import lk.swiftdrop.shipping.config.ShippingConfigService;
import lk.swiftdrop.shipping.config.ShippingSettings;
import lk.swiftdrop.shipping.parcel.ChargeableWeight;
import lk.swiftdrop.shipping.parcel.Parcel;
import lk.swiftdrop.shipping.parcel.ParcelCalculator;
import lk.swiftdrop.shipping.parcel.ParcelItem;
import lk.swiftdrop.shipping.pricing.MarkupCalculator;
import lk.swiftdrop.shipping.pricing.MarkupRule;
import lk.swiftdrop.shipping.pricing.MarkupRuleRepository;
import lk.swiftdrop.shipping.pricing.MarkupRuleSelector;
import lk.swiftdrop.shipping.pricing.RateCard;
import lk.swiftdrop.shipping.pricing.RateCardRepository;
import lk.swiftdrop.shipping.quote.QuoteDtos.AdminQuoteResponse;
import lk.swiftdrop.shipping.quote.QuoteDtos.ItemLine;
import lk.swiftdrop.shipping.quote.QuoteDtos.OptionBreakdown;
import lk.swiftdrop.shipping.quote.QuoteDtos.ParcelView;
import lk.swiftdrop.shipping.quote.QuoteDtos.PublicOption;
import lk.swiftdrop.shipping.quote.QuoteDtos.PublicQuoteResponse;
import lk.swiftdrop.shipping.quote.QuoteDtos.QuoteItemRequest;
import lk.swiftdrop.shipping.quote.QuoteDtos.QuoteRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Works out shipping prices on the server:
 * items → parcel (box, weights) → per courier service: chargeable weight →
 * courier price (rate card) → platform fee (markup rule) → customer price.
 *
 * <p>Nothing here calls a courier. DHL live rates come in Shipping Phase D.
 */
@Service
public class QuoteService {

    static final Duration QUOTE_VALIDITY = Duration.ofMinutes(30);
    static final String CURRENCY = "LKR";

    private final ProductVariantRepository variants;
    private final ShippingConfigService config;
    private final ShippingCategoryPolicyRepository policies;
    private final PackagePresetRepository presets;
    private final CourierProviderRepository providers;
    private final RateCardRepository rateCards;
    private final MarkupRuleRepository markupRules;
    private final ShippingQuoteRepository quotes;
    private final Clock clock;

    @SuppressWarnings("checkstyle:ParameterNumber")
    public QuoteService(ProductVariantRepository variants, ShippingConfigService config,
                        ShippingCategoryPolicyRepository policies, PackagePresetRepository presets,
                        CourierProviderRepository providers, RateCardRepository rateCards,
                        MarkupRuleRepository markupRules, ShippingQuoteRepository quotes, Clock clock) {
        this.variants = variants;
        this.config = config;
        this.policies = policies;
        this.presets = presets;
        this.providers = providers;
        this.rateCards = rateCards;
        this.markupRules = markupRules;
        this.quotes = quotes;
        this.clock = clock;
    }

    /** Customer quote: only items for sale; saved for 30 minutes when at least one option is available. */
    @Transactional
    public PublicQuoteResponse quoteForCustomer(QuoteRequest request) {
        Calculation calc = calculate(request, false);
        if (!calc.problems.isEmpty() || calc.options.stream().noneMatch(OptionBreakdown::available)) {
            List<String> problems = calc.problems.isEmpty()
                    ? List.of("Delivery to this destination is not available online yet. Please contact us for a quote.")
                    : calc.problems;
            return new PublicQuoteResponse(null, calc.country, calc.domestic, null,
                    calc.settings.getDutiesPaidBy(), List.of(), problems, null, false);
        }
        Instant now = clock.instant();
        ShippingQuote quote = new ShippingQuote(calc.country, blankToNull(request.postalCode()), calc.domestic,
                calc.parcel, now, now.plus(QUOTE_VALIDITY));
        int position = 0;
        for (OptionBreakdown option : calc.options) {
            if (option.available()) {
                quote.addOption(new ShippingQuoteOption(quote, calc.drafts.get(option.serviceId()), position++));
            }
        }
        quotes.save(quote);
        return toPublic(quote, calc.settings);
    }

    /** A saved quote, as the customer sees it. */
    @Transactional(readOnly = true)
    public PublicQuoteResponse getForCustomer(UUID id) {
        ShippingQuote quote = quotes.findById(id).orElseThrow(() -> new ResourceNotFoundException("Shipping quote", id));
        return toPublic(quote, config.currentSettings());
    }

    /** Admin simulator: full breakdown, also for draft products. Nothing is saved. */
    @Transactional(readOnly = true)
    public AdminQuoteResponse simulate(QuoteRequest request) {
        Calculation calc = calculate(request, true);
        Parcel p = calc.parcel;
        ParcelView parcel = p == null ? null : new ParcelView(p.itemsWeightKg(), p.packagingKg(), p.actualWeightKg(),
                p.boxName(), p.lengthCm(), p.widthCm(), p.heightCm(), p.fits());
        return new AdminQuoteResponse(calc.country, calc.domestic, calc.settings.getDutiesPaidBy(), calc.lines,
                parcel, calc.problems, calc.warnings, calc.options);
    }

    // ------------------------------------------------------------------

    /** Everything worked out for one request. */
    private static final class Calculation {
        String country;
        boolean domestic;
        ShippingSettings settings;
        Parcel parcel;
        final List<ItemLine> lines = new ArrayList<>();
        final List<String> problems = new ArrayList<>();
        final List<String> warnings = new ArrayList<>();
        final List<OptionBreakdown> options = new ArrayList<>();
        final Map<UUID, QuoteOptionDraft> drafts = new java.util.HashMap<>();
    }

    private Calculation calculate(QuoteRequest request, boolean includeHidden) {
        if (!Countries.isValid(request.countryCode())) {
            throw new BadRequestException("Unknown country code: " + request.countryCode());
        }
        if (new HashSet<>(request.items().stream().map(QuoteItemRequest::variantId).toList()).size()
                != request.items().size()) {
            throw new BadRequestException("Each product option may appear only once; add up the quantity instead.");
        }
        Calculation calc = new Calculation();
        calc.country = request.countryCode();
        calc.settings = config.currentSettings();
        calc.domestic = calc.country.equals(calc.settings.getOriginCountry());

        Map<UUID, ProductVariant> found = variants.findAllWithProductByIdIn(
                        request.items().stream().map(QuoteItemRequest::variantId).toList())
                .stream().collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        Map<ShippingCategory, ShippingCategoryPolicy> policyMap = policies.findAll().stream()
                .collect(Collectors.toMap(ShippingCategoryPolicy::getCategory, Function.identity()));

        List<ParcelItem> parcelItems = new ArrayList<>();
        int itemsWithoutSize = 0;
        for (QuoteItemRequest item : request.items()) {
            ProductVariant variant = found.get(item.variantId());
            if (variant == null || !includeHidden && !isForSale(variant)) {
                // Same message for "missing" and "hidden", so nothing about drafts leaks.
                throw new BadRequestException("One of the items is not available.");
            }
            Product product = variant.getProduct();
            if (!variant.getQuantityRules().allows(item.quantity())) {
                throw new BadRequestException("The quantity for " + product.getName() + " is not allowed.");
            }
            String problem = null;
            ShippingCategoryPolicy policy = policyMap.get(product.getShippingCategory());
            // The category's rules first, then the product's own (which can only add restrictions).
            if (policy == null || !policy.allows(calc.country, calc.domestic)
                    || !product.shippingAllows(calc.country, calc.domestic)) {
                problem = product.getName() + " cannot be shipped to " + countryName(calc.country) + ".";
            } else if (variant.getShippingWeightKg() == null) {
                problem = product.getName() + " has no shipping weight yet, so delivery cannot be priced.";
            }
            if (problem != null) {
                calc.problems.add(problem);
            }
            calc.lines.add(new ItemLine(variant.getId(), product.getName(), variant.getSku(),
                    product.getShippingCategory().name(), item.quantity(), variant.getShippingWeightKg(), problem));
            if (variant.getShippingWeightKg() != null) {
                var d = variant.getDimensions();
                if (d == null) {
                    itemsWithoutSize++;
                }
                parcelItems.add(new ParcelItem(product.getName(), variant.getShippingWeightKg(), item.quantity(),
                        d == null ? null : d.lengthCm(), d == null ? null : d.widthCm(), d == null ? null : d.heightCm()));
            }
        }
        if (!calc.problems.isEmpty()) {
            return calc;
        }

        List<PackagePreset> boxes = presets.findAllByEnabledTrue();
        calc.parcel = ParcelCalculator.pack(parcelItems,
                boxes.stream().map(PackagePreset::toBoxSpec).toList(), calc.settings.getDefaultPackagingKg());
        if (!calc.parcel.fits()) {
            calc.problems.add("This order is too big or too heavy for our standard boxes. Please contact us for a quote.");
            return calc;
        }
        if (boxes.isEmpty()) {
            calc.warnings.add("No box sizes are set up, so the parcel size is unknown (couriers that charge by size cannot be priced).");
        } else if (itemsWithoutSize > 0) {
            calc.warnings.add(itemsWithoutSize + " item(s) have no packed size; the box was chosen from the other items only.");
        }

        ServiceScope scope = calc.domestic ? ServiceScope.DOMESTIC : ServiceScope.INTERNATIONAL;
        List<MarkupRule> rules = markupRules.findAllByEnabledTrue();
        Instant now = clock.instant();
        for (CourierProviderConfig provider : providers.findAllByOrderByNameAsc()) {
            provider.getServices().stream()
                    .filter(service -> service.getScope() == scope)
                    .sorted(Comparator.comparing(CourierServiceConfig::getName))
                    .forEach(service -> calc.options.add(priceOption(calc, provider, service, rules, now)));
        }
        return calc;
    }

    private OptionBreakdown priceOption(Calculation calc, CourierProviderConfig provider, CourierServiceConfig service,
                                        List<MarkupRule> rules, Instant now) {
        if (!provider.isEnabled() || !service.isEnabled()) {
            return unavailable(provider, service, "Courier or service is turned off.", null, null);
        }
        if (provider.getRatesSource() == RatesSource.API) {
            return unavailable(provider, service, "Live rates are not connected yet (Shipping Phase D).", null, null);
        }
        Parcel parcel = calc.parcel;
        if (provider.getVolumetricDivisor() != null && !parcel.hasDimensions()) {
            return unavailable(provider, service, "This courier charges by size, but the parcel size is unknown (set up box sizes).", null, null);
        }
        BigDecimal volumetric = ChargeableWeight.volumetric(parcel, provider.getVolumetricDivisor());
        BigDecimal chargeable = ChargeableWeight.chargeable(parcel.actualWeightKg(), volumetric,
                provider.getWeightRoundingIncrementKg());

        Optional<RateCard> card = rateCards.findByServiceIdAndCountryCodeAndEnabledTrue(service.getId(), calc.country);
        if (card.isEmpty()) {
            return unavailable(provider, service, "No rate card for " + countryName(calc.country) + ".", volumetric, chargeable);
        }
        Optional<BigDecimal> courierPrice = card.get().priceFor(chargeable);
        if (courierPrice.isEmpty()) {
            return unavailable(provider, service, "Heavier than the highest weight band on the rate card.", volumetric, chargeable);
        }

        BigDecimal cost = courierPrice.get().setScale(2, java.math.RoundingMode.HALF_UP);
        Optional<MarkupRule> rule = MarkupRuleSelector.select(rules, provider.getId(), calc.country, now);
        BigDecimal fee = rule.map(r -> MarkupCalculator.fee(cost, r.toMarkup())).orElse(BigDecimal.ZERO.setScale(2));
        String description = rule.map(r -> MarkupCalculator.describe(r.getName(), r.toMarkup())).orElse("No platform fee");
        BigDecimal customerPrice = cost.add(fee);

        calc.drafts.put(service.getId(), new QuoteOptionDraft(service.getId(), provider.getCode(), provider.getName(),
                service.getName(), volumetric, chargeable, cost, fee, customerPrice, CURRENCY,
                rule.map(MarkupRule::getId).orElse(null), description));
        return new OptionBreakdown(service.getId(), provider.getCode(), provider.getName(), service.getName(),
                service.getScope(), true, null, volumetric, chargeable, MoneyResponse.of(cost, CURRENCY),
                MoneyResponse.of(fee, CURRENCY), MoneyResponse.of(customerPrice, CURRENCY),
                rule.map(MarkupRule::getId).orElse(null), description);
    }

    private static OptionBreakdown unavailable(CourierProviderConfig provider, CourierServiceConfig service,
                                               String reason, BigDecimal volumetric, BigDecimal chargeable) {
        return new OptionBreakdown(service.getId(), provider.getCode(), provider.getName(), service.getName(),
                service.getScope(), false, reason, volumetric, chargeable, null, null, null, null, null);
    }

    private PublicQuoteResponse toPublic(ShippingQuote quote, ShippingSettings settings) {
        List<PublicOption> options = quote.getOptions().stream()
                .map(o -> new PublicOption(o.getId(), o.getProviderName(), o.getServiceName(),
                        MoneyResponse.of(o.getCustomerPrice(), o.getCurrency())))
                .toList();
        return new PublicQuoteResponse(quote.getId(), quote.getDestinationCountry(), quote.isDomestic(),
                quote.getActualWeightKg(), settings.getDutiesPaidBy(), options, List.of(), quote.getExpiresAt(),
                !clock.instant().isBefore(quote.getExpiresAt()));
    }


    private static boolean isForSale(ProductVariant variant) {
        Product product = variant.getProduct();
        return variant.isActive() && product.getStatus() == ProductStatus.ACTIVE && product.getCategory().isActive();
    }

    private static String countryName(String code) {
        return java.util.Locale.of("", code).getDisplayCountry(java.util.Locale.ENGLISH);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
