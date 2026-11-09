import { useState } from 'react'
import { cn } from '../../lib/cn'
import type { ProductImage as ProductPhoto } from '../../types/catalog'
import { ProductImage } from './ProductImage'

type ProductGalleryProps = { images: ProductPhoto[]; productName: string }

/** The main photo, plus small thumbnails to switch photos when there is more than one. */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selected, setSelected] = useState(0)
  const current = images[selected] ?? images[0]

  return (
    <div>
      <ProductImage
        src={current?.url ?? null}
        alt={current?.altText || productName}
      />
      {images.length > 1 && (
        <ul
          className="mt-3 flex gap-2 overflow-x-auto p-1"
          aria-label="Product photos"
        >
          {images.map((image, index) => (
            <li key={image.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`Show photo ${index + 1} of ${images.length}`}
                aria-current={index === selected ? 'true' : undefined}
                className={cn(
                  'size-16 overflow-hidden rounded-lg border-2',
                  index === selected
                    ? 'border-brand-700'
                    : 'border-transparent opacity-70 hover:opacity-100',
                )}
              >
                <img
                  src={image.url}
                  alt=""
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
