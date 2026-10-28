package lk.swiftdrop.catalog.category;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lk.swiftdrop.catalog.product.ProductRepository;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules for categories. Controllers stay thin and call this class.
 *
 * <p>Dependencies arrive through the constructor (dependency injection):
 * Spring creates the repositories and passes them in. Tests can pass mocks.
 */
@Service
@Transactional(readOnly = true)
public class CategoryService {

    private final CategoryRepository categories;
    private final ProductRepository products;

    public CategoryService(CategoryRepository categories, ProductRepository products) {
        this.categories = categories;
        this.products = products;
    }

    /** Storefront: active categories only, in display order. */
    public List<CategoryResponse> listActive() {
        return categories.findAllByActiveTrueOrderBySortOrderAscNameAsc().stream()
                .map(CategoryResponse::from)
                .toList();
    }

    /** Admin: every category, including inactive ones. */
    public List<CategoryResponse> listAll() {
        return categories.findAllByOrderBySortOrderAscNameAsc().stream()
                .map(CategoryResponse::from)
                .toList();
    }

    public CategoryResponse get(UUID id) {
        return CategoryResponse.from(find(id));
    }

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        if (categories.existsBySlug(request.slug())) {
            throw new ConflictException("A category with slug '" + request.slug() + "' already exists.");
        }
        Category category = new Category(
                request.name().trim(),
                request.slug(),
                request.description(),
                Objects.requireNonNullElse(request.sortOrder(), 0),
                Objects.requireNonNullElse(request.active(), true));
        return CategoryResponse.from(categories.save(category));
    }

    @Transactional
    public CategoryResponse update(UUID id, CategoryRequest request) {
        Category category = find(id);
        if (categories.existsBySlugAndIdNot(request.slug(), id)) {
            throw new ConflictException("A category with slug '" + request.slug() + "' already exists.");
        }
        category.update(
                request.name().trim(),
                request.slug(),
                request.description(),
                Objects.requireNonNullElse(request.sortOrder(), 0),
                Objects.requireNonNullElse(request.active(), true));
        // No save() call needed: changes to a loaded entity are written at commit.
        return CategoryResponse.from(category);
    }

    @Transactional
    public void delete(UUID id) {
        Category category = find(id);
        if (products.existsByCategoryId(id)) {
            throw new ConflictException(
                    "Category '" + category.getSlug() + "' still has products. Move or delete them first, or deactivate the category.");
        }
        categories.delete(category);
    }

    private Category find(UUID id) {
        return categories.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }
}
