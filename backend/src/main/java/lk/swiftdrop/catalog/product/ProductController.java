package lk.swiftdrop.catalog.product;

import lk.swiftdrop.catalog.product.ProductResponses.ProductDetail;
import lk.swiftdrop.catalog.product.ProductResponses.ProductSummary;
import java.util.Set;
import lk.swiftdrop.common.web.PageResponse;
import lk.swiftdrop.common.web.SortWhitelist;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Public, read-only product endpoints for the storefront. */
@RestController
@RequestMapping("/api/products")
public class ProductController {

    /** Fields clients may sort by, e.g. ?sort=name,asc */
    private static final Set<String> SORTABLE = Set.of("createdAt", "name");

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    /**
     * GET /api/products?category=fashion&page=0&size=20&sort=name,asc
     * Pageable is filled from page, size and sort automatically (max size: 100).
     */
    @GetMapping
    public ResponseEntity<PageResponse<ProductSummary>> list(
            @RequestParam(name = "category", required = false) String categorySlug,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(productService.listVisible(categorySlug, SortWhitelist.requireAllowed(pageable, SORTABLE)));
    }

    /** 200, or 404 if the product does not exist or is not ACTIVE. */
    @GetMapping("/{slug}")
    public ResponseEntity<ProductDetail> get(@PathVariable String slug) {
        return ResponseEntity.ok(productService.getVisibleBySlug(slug));
    }
}
