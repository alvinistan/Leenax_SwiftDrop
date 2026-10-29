package lk.swiftdrop.catalog.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lk.swiftdrop.catalog.category.Category;
import lk.swiftdrop.catalog.category.CategoryRepository;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.store.StoreDefaults;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit test: plain Java + Mockito. No Spring, no database. Tests the business
 * rules of ProductService in milliseconds.
 */
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    private static final UUID CATEGORY_ID = UUID.randomUUID();

    @Mock
    private ProductRepository products;
    @Mock
    private ProductVariantRepository variants;
    @Mock
    private CategoryRepository categories;

    /** Mockito creates the service and passes the three mocks to its constructor. */
    @InjectMocks
    private ProductService productService;

    private static ProductRequest request(String slug, List<VariantRequest> variantRequests) {
        return new ProductRequest(CATEGORY_ID, "  Cotton T-Shirt ", slug, null, ProductStatus.ACTIVE, variantRequests);
    }

    private static VariantRequest variant(String sku, String price, Map<String, String> options) {
        return new VariantRequest(sku, new BigDecimal(price), options, null, null, null, null, null);
    }

    @Test
    void createsProductForTheDefaultSellerWithVariantsInOrder() {
        given(products.existsBySlug("cotton-t-shirt")).willReturn(false);
        given(variants.findExistingSkus(anyCollection())).willReturn(List.of());
        given(categories.findById(CATEGORY_ID))
                .willReturn(Optional.of(new Category("Fashion", "fashion", null, 0, true)));
        given(products.save(any())).willAnswer(invocation -> invocation.getArgument(0));

        productService.create(request("cotton-t-shirt", List.of(
                variant("TSHIRT-M", "2900.00", Map.of("Size", "M")),
                variant("TSHIRT-L", "3100.00", Map.of("Size", "L")))));

        ArgumentCaptor<Product> saved = ArgumentCaptor.forClass(Product.class);
        verify(products).save(saved.capture());
        Product product = saved.getValue();
        assertThat(product.getName()).isEqualTo("Cotton T-Shirt");
        assertThat(product.getSellerId()).isEqualTo(StoreDefaults.DEFAULT_SELLER_ID);
        assertThat(product.getCurrency()).isEqualTo("LKR");
        assertThat(product.getVariants()).extracting(ProductVariant::getSku).containsExactly("TSHIRT-M", "TSHIRT-L");
        assertThat(product.getVariants()).allMatch(ProductVariant::isActive);
        assertThat(product.cheapestActiveVariant()).map(ProductVariant::getPrice).contains(new BigDecimal("2900.00"));
        // no sale unit given → sold by the piece, one or more whole pieces
        assertThat(product.getVariants()).allMatch(v -> v.getSaleUnit() == SaleUnit.PIECE);
        assertThat(product.getVariants().getFirst().getQuantityRules())
                .isEqualTo(new QuantityRules(BigDecimal.ONE, null, BigDecimal.ONE));
    }

    @Test
    void rejectsADuplicateSlugWithoutSaving() {
        given(products.existsBySlug("cotton-t-shirt")).willReturn(true);

        assertThatThrownBy(() -> productService.create(
                request("cotton-t-shirt", List.of(variant("TSHIRT-M", "2900.00", Map.of())))))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("cotton-t-shirt");

        verify(products, never()).save(any());
    }

    @Test
    void rejectsSkusThatAreAlreadyUsedByOtherProducts() {
        given(products.existsBySlug("cotton-t-shirt")).willReturn(false);
        given(variants.findExistingSkus(anyCollection())).willReturn(List.of("TSHIRT-M"));

        assertThatThrownBy(() -> productService.create(
                request("cotton-t-shirt", List.of(variant("TSHIRT-M", "2900.00", Map.of())))))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("TSHIRT-M");
    }

    @Test
    void reportsAnUnknownCategoryAsNotFound() {
        given(products.existsBySlug("cotton-t-shirt")).willReturn(false);
        given(variants.findExistingSkus(anyCollection())).willReturn(List.of());
        given(categories.findById(CATEGORY_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> productService.create(
                request("cotton-t-shirt", List.of(variant("TSHIRT-M", "2900.00", Map.of())))))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
