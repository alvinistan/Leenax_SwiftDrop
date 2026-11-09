import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { userMessage } from '../../lib/errors'
import {
  deleteProductImage,
  uploadProductImage,
  type AdminImage,
} from './imageApi'
import { ImageUploader } from './ImageUploader'

const MAX_IMAGES = 10

/** Product photos. Uploads and deletions are saved at once (not with the form's Save button). */
export function ProductImagesSection({
  productId,
  initial,
}: {
  productId: string
  initial: AdminImage[]
}) {
  const [images, setImages] = useState(initial)
  const [toDelete, setToDelete] = useState<AdminImage | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<{
    tone: 'success' | 'error'
    text: string
  }>()

  async function confirmDelete() {
    if (!toDelete) return
    setIsDeleting(true)
    try {
      await deleteProductImage(productId, toDelete.id)
      setImages((current) =>
        current.filter((image) => image.id !== toDelete.id),
      )
      setMessage({ tone: 'success', text: 'Photo deleted.' })
    } catch (error) {
      setMessage({ tone: 'error', text: userMessage(error) })
    } finally {
      setIsDeleting(false)
      setToDelete(null)
    }
  }

  return (
    <section
      aria-labelledby="photos-heading"
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
    >
      <div>
        <h2
          id="photos-heading"
          className="text-lg font-semibold text-slate-900"
        >
          Photos
        </h2>
        <p className="text-sm text-slate-600">
          The first photo is the main one. Photos are saved as soon as you
          upload them.
        </p>
      </div>

      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className="text-sm font-medium text-slate-700"
        >
          {message.text}
        </p>
      )}

      {images.length > 0 ? (
        <ul
          className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          aria-label="Uploaded photos"
        >
          {images.map((image, index) => (
            <li
              key={image.id}
              className="relative overflow-hidden rounded-lg border border-slate-200"
            >
              <img
                src={image.url}
                alt={image.altText ?? `Photo ${index + 1}`}
                className="aspect-square w-full object-cover"
              />
              {index === 0 && (
                <span className="absolute left-2 top-2 rounded bg-white/90 px-2 py-0.5 text-xs font-semibold">
                  Main
                </span>
              )}
              <button
                type="button"
                onClick={() => setToDelete(image)}
                aria-label={`Delete photo ${index + 1}`}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-red-700 hover:bg-white"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No photos yet.</p>
      )}

      {images.length < MAX_IMAGES ? (
        <ImageUploader
          label="Upload photo"
          withAltText
          onUpload={async (file, altText, onProgress) => {
            setMessage(undefined)
            const image = await uploadProductImage(
              productId,
              file,
              altText,
              onProgress,
            )
            setImages((current) => [...current, image])
            setMessage({ tone: 'success', text: 'Photo uploaded.' })
          }}
        />
      ) : (
        <p className="text-sm text-slate-600">
          This product has the maximum of {MAX_IMAGES} photos.
        </p>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this photo?"
        message="The photo is removed from the product and from storage. This cannot be undone."
        confirmLabel="Delete photo"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
        isWorking={isDeleting}
      />
    </section>
  )
}
