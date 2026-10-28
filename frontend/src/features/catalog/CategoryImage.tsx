import type { Category } from '../../types/catalog'

/** Round category picture, or the category's first letter until an image is uploaded. */
export function CategoryImage({ category }: { category: Category }) {
  if (!category.imageUrl) {
    return (
      <div
        aria-hidden="true"
        className="flex size-full items-center justify-center rounded-full bg-brand-50 text-3xl font-semibold text-brand-700"
      >
        {category.name.charAt(0)}
      </div>
    )
  }

  return (
    <img
      src={category.imageUrl}
      // The name is already shown under the picture, so the image is decorative.
      alt=""
      loading="lazy"
      className="size-full rounded-full object-cover"
    />
  )
}
