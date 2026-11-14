package lk.swiftdrop.shipping.web;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lk.swiftdrop.shipping.config.Countries;
import lk.swiftdrop.shipping.config.ShippingConfigService;
import lk.swiftdrop.shipping.quote.QuoteDtos.PublicQuoteResponse;
import lk.swiftdrop.shipping.quote.QuoteDtos.QuoteRequest;
import lk.swiftdrop.shipping.quote.QuoteService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public shipping quotes. The customer sees only the delivery price, never the
 * courier's cost or the platform fee. Prices in the request are not accepted.
 */
@RestController
@RequestMapping("/api/shipping")
public class ShippingQuoteController {

    private final QuoteService quotes;
    private final ShippingConfigService config;

    public ShippingQuoteController(QuoteService quotes, ShippingConfigService config) {
        this.quotes = quotes;
        this.config = config;
    }

    @PostMapping("/quotes")
    public ResponseEntity<PublicQuoteResponse> quote(@Valid @RequestBody QuoteRequest request) {
        return ResponseEntity.ok(quotes.quoteForCustomer(request));
    }

    /** Countries we deliver to, for the checkout address form. Public. */
    @GetMapping("/destinations")
    public ResponseEntity<List<Countries.Country>> destinations() {
        return ResponseEntity.ok(config.listDestinations().stream()
                .map(code -> new Countries.Country(code, java.util.Locale.of("", code).getDisplayCountry(java.util.Locale.ENGLISH)))
                .sorted(java.util.Comparator.comparing(Countries.Country::name))
                .toList());
    }

    @GetMapping("/quotes/{id}")
    public ResponseEntity<PublicQuoteResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(quotes.getForCustomer(id));
    }
}
