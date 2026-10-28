package lk.swiftdrop.catalog.product;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import lk.swiftdrop.catalog.product.ProductResponses.ProductDetail;
import lk.swiftdrop.catalog.product.ProductResponses.ProductSummary;
import java.util.Set;
import lk.swiftdrop.common.web.PageResponse;
import lk.swiftdrop.common.web.SortWhitelist;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * Admin product management, including products in DRAFT and ARCHIVED status.
 *
 * <p><b>WARNING:</b> not secured until Phase 6 (Spring Security). Local development only.
 */
@RestController
@RequestMapping("/api/admin/products")
public class AdminProductController {

    /** Fields clients may sort by, e.g. ?sort=name,asc */
    private static final Set<String> SORTABLE = Set.of("createdAt", "name");

    private final ProductService productService;

    public AdminProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<ProductSummary>> list(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(productService.listAll(SortWhitelist.requireAllowed(pageable, SORTABLE)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductDetail> get(@PathVariable UUID id) {
        return ResponseEntity.ok(productService.get(id));
    }

    /** 201 Created + Location header. 400 invalid, 404 unknown category, 409 slug or SKU taken. */
    @PostMapping
    public ResponseEntity<ProductDetail> create(@Valid @RequestBody ProductRequest request) {
        ProductDetail created = productService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductDetail> update(
            @PathVariable UUID id, @Valid @RequestBody ProductUpdateRequest request) {
        return ResponseEntity.ok(productService.update(id, request));
    }

    /** 204 No Content. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        productService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
