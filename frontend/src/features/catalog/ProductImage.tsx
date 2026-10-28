import { ImageOff } from 'lucide-react'

type ProductImageProps = { src: string | null; alt: string }

/** Product photo in a fixed 4:3 frame, or a neutral placeholder when there is none yet. */
export function ProductImage({ src, alt }: ProductImageProps) {
  if (!src) {
    return (
      <div className="flex aspect-4/3 flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400">
        <ImageOff className="size-8" aria-hidden="true" />
        <span className="text-xs font-medium">Photo coming soon</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      // Lazy loading: images below the screen download only when scrolled to.
      loading="lazy"
      className="aspect-4/3 w-full object-cover"
    />
  )
}
