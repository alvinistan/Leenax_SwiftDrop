package lk.swiftdrop.shipping.web;

import jakarta.validation.Valid;
import java.util.UUID;
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
@RequestMapping("/api/shipping/quotes")
public class ShippingQuoteController {

    private final QuoteService quotes;

    public ShippingQuoteController(QuoteService quotes) {
        this.quotes = quotes;
    }

    @PostMapping
    public ResponseEntity<PublicQuoteResponse> quote(@Valid @RequestBody QuoteRequest request) {
        return ResponseEntity.ok(quotes.quoteForCustomer(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PublicQuoteResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(quotes.getForCustomer(id));
    }
}
