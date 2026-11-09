import { Upload } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { userMessage } from '../../lib/errors'
import type { ProgressCallback } from './imageApi'
import { ACCEPTED_IMAGE_TYPES, checkImageFile } from './imageFile'

type ImageUploaderProps = {
  /** Shown on the button, e.g. "Upload photo". */
  label: string
  /** Ask for a description of the photo (for screen readers). */
  withAltText?: boolean
  onUpload: (
    file: File,
    altText: string,
    onProgress: ProgressCallback,
  ) => Promise<void>
}

export function ImageUploader({
  label,
  withAltText = false,
  onUpload,
}: ImageUploaderProps) {
  const fileId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File>()
  const [altText, setAltText] = useState('')
  const [error, setError] = useState<string>()
  const [percent, setPercent] = useState<number>()

  async function upload() {
    if (!file) return
    setError(undefined)
    setPercent(0)
    try {
      await onUpload(file, altText, setPercent)
      // Reset for the next photo
      setFile(undefined)
      setAltText('')
      if (fileInput.current) fileInput.current.value = ''
    } catch (uploadError) {
      setError(userMessage(uploadError))
    } finally {
      setPercent(undefined)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fileId} className="text-sm font-medium text-slate-800">
          Image file
        </label>
        <input
          id={fileId}
          ref={fileInput}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          aria-describedby={`${fileId}-hint`}
          onChange={(event) => {
            const chosen = event.target.files?.[0]
            const problem = chosen ? checkImageFile(chosen) : undefined
            setError(problem)
            setFile(problem ? undefined : chosen)
          }}
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium"
        />
        <p id={`${fileId}-hint`} className="text-sm text-slate-500">
          JPEG, PNG or WebP, up to 5 MB.
        </p>
      </div>
      {withAltText && (
        <Input
          label="Description (for screen readers)"
          hint='For example: "Chocolate cake with strawberries on top"'
          maxLength={200}
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
        />
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {percent !== undefined && (
        <progress
          value={percent}
          max={100}
          aria-label="Upload progress"
          className="w-full"
        >
          {percent}%
        </progress>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={upload}
        disabled={!file}
        isLoading={percent !== undefined}
      >
        <Upload className="size-4" aria-hidden="true" /> {label}
      </Button>
    </div>
  )
}
