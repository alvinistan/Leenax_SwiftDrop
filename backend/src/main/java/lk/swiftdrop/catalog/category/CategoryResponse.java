package lk.swiftdrop.catalog.category;

import java.util.UUID;

/** A category as returned by the API. */
public record CategoryResponse(
        UUID id,
        String name,
        String slug,
        String description,
        /** Always null until category image upload is added (Phases 6–7). */
        String imageUrl,
        int sortOrder,
        boolean active) {

    static CategoryResponse from(Category category) {
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getSlug(),
                category.getDescription(),
                null,
                category.getSortOrder(),
                category.isActive());
    }
}
