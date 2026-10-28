package lk.swiftdrop.catalog.category;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Body of POST and PUT /api/admin/categories. Validated before the controller runs. */
public record CategoryRequest(
        @NotBlank(message = "Name is required.")
        @Size(max = 100, message = "Name must be at most 100 characters.")
        String name,

        @NotBlank(message = "Slug is required.")
        @Size(max = 100, message = "Slug must be at most 100 characters.")
        @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$",
                message = "Slug may contain only lowercase letters, numbers and single hyphens, e.g. home-kitchen.")
        String slug,

        @Size(max = 1000, message = "Description must be at most 1000 characters.")
        String description,

        /** Optional; defaults to 0. */
        @PositiveOrZero(message = "Sort order cannot be negative.")
        Integer sortOrder,

        /** Optional; defaults to true. */
        Boolean active) {
}
