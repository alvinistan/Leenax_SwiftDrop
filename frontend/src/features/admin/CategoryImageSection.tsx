import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { userMessage } from '../../lib/errors'
import { deleteCategoryImage, uploadCategoryImage } from './imageApi'
import { ImageUploader } from './ImageUploader'

/** The round picture shown in the store's "Shop by category" carousel. Saved at once. */
export function CategoryImageSection({
  categoryId,
  initialUrl,
}: {
  categoryId: string
  initialUrl: string | null
}) {
  const [imageUrl, setImageUrl] = useState(initialUrl)
  const [error, setError] = useState<string>()
  const [isRemoving, setIsRemoving] = useState(false)

  return (
    <section
      aria-labelledby="category-picture-heading"
      className="mt-6 max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6"
    >
      <div>
        <h2
          id="category-picture-heading"
          className="text-lg font-semibold text-slate-900"
        >
          Picture
        </h2>
        <p className="text-sm text-slate-600">
          Shown in a circle in the store. Square images look best. Saved as soon
          as you upload.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="size-24 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Current category picture"
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-xs text-slate-500">
              No picture
            </span>
          )}
        </div>
        {imageUrl && (
          <Button
            variant="ghost"
            size="sm"
            isLoading={isRemoving}
            onClick={async () => {
              setError(undefined)
              setIsRemoving(true)
              try {
                await deleteCategoryImage(categoryId)
                setImageUrl(null)
              } catch (removeError) {
                setError(userMessage(removeError))
              } finally {
                setIsRemoving(false)
              }
            }}
          >
            Remove picture
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <ImageUploader
        label={imageUrl ? 'Replace picture' : 'Upload picture'}
        onUpload={async (file, _altText, onProgress) => {
          const category = await uploadCategoryImage(
            categoryId,
            file,
            onProgress,
          )
          setImageUrl(category.imageUrl)
        }}
      />
    </section>
  )
}
