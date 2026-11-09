package lk.swiftdrop.catalog.category;

import java.util.UUID;

/** A category as returned by the API. */
public record CategoryResponse(
        UUID id,
        String name,
        String slug,
        String description,
        /** A short-lived link to the round picture, or null if there is none. */
        String imageUrl,
        int sortOrder,
        boolean active) {

    static CategoryResponse from(Category category, String imageUrl) {
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getSlug(),
                category.getDescription(),
                imageUrl,
                category.getSortOrder(),
                category.isActive());
    }
}
