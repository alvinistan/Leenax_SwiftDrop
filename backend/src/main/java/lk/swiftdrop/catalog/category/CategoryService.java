package lk.swiftdrop.catalog.category;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lk.swiftdrop.catalog.product.ProductRepository;
import lk.swiftdrop.common.error.ConflictException;
import lk.swiftdrop.common.error.ResourceNotFoundException;
import lk.swiftdrop.media.ImageUploads;
import lk.swiftdrop.media.ImageUploads.StoredImage;
import org.springframework.web.multipart.MultipartFile;
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
    private final ImageUploads imageUploads;

    public CategoryService(CategoryRepository categories, ProductRepository products, ImageUploads imageUploads) {
        this.categories = categories;
        this.products = products;
        this.imageUploads = imageUploads;
    }

    private CategoryResponse toResponse(Category category) {
        return CategoryResponse.from(category, imageUploads.urlFor(category.getImageObjectKey()));
    }

    /** Storefront: active categories only, in display order. */
    public List<CategoryResponse> listActive() {
        return categories.findAllByActiveTrueOrderBySortOrderAscNameAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    /** Admin: every category, including inactive ones. */
    public List<CategoryResponse> listAll() {
        return categories.findAllByOrderBySortOrderAscNameAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    public CategoryResponse get(UUID id) {
        return toResponse(find(id));
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
        return toResponse(categories.save(category));
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
        return toResponse(category);
    }

    @Transactional
    public void delete(UUID id) {
        Category category = find(id);
        if (products.existsByCategoryId(id)) {
            throw new ConflictException(
                    "Category '" + category.getSlug() + "' still has products. Move or delete them first, or deactivate the category.");
        }
        categories.delete(category);
        if (category.getImageObjectKey() != null) {
            imageUploads.deleteAfterCommit(category.getImageObjectKey());
        }
    }

    /**
     * Sets (or replaces) the category's round picture. The file is stored first;
     * if saving to the database then fails, the new file is removed again.
     */
    @Transactional
    public CategoryResponse uploadImage(UUID id, MultipartFile file) {
        Category category = find(id);
        StoredImage stored = imageUploads.store("categories/" + id, file);
        try {
            String previous = category.replaceImage(stored.key());
            categories.flush(); // surface database errors here, while we can still undo the upload
            if (previous != null) {
                imageUploads.deleteAfterCommit(previous);
            }
        } catch (RuntimeException e) {
            imageUploads.deleteQuietly(stored.key());
            throw e;
        }
        return toResponse(category);
    }

    @Transactional
    public void removeImage(UUID id) {
        Category category = find(id);
        String previous = category.replaceImage(null);
        if (previous != null) {
            imageUploads.deleteAfterCommit(previous);
        }
    }

    private Category find(UUID id) {
        return categories.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }
}
