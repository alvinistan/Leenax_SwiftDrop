import { http } from '../../api/http'
import type { Category } from '../../types/catalog'

/** A product photo as the admin sees it (with its id, so it can be deleted). */
export type AdminImage = { id: string; url: string; altText: string | null }

/** Called during upload with a number from 0 to 100. */
export type ProgressCallback = (percent: number) => void

/**
 * Files are sent as multipart/form-data (the standard way browsers upload
 * files). Don't set the Content-Type yourself: the browser adds the
 * "boundary" that separates the parts.
 */
function formWith(file: File, fields: Record<string, string> = {}) {
  const form = new FormData()
  form.append('file', file)
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  return form
}

function progress(onProgress?: ProgressCallback) {
  return (event: { loaded: number; total?: number }) => {
    if (onProgress && event.total)
      onProgress(Math.round((event.loaded / event.total) * 100))
  }
}

export async function uploadProductImage(
  productId: string,
  file: File,
  altText: string,
  onProgress?: ProgressCallback,
): Promise<AdminImage> {
  const response = await http.post<AdminImage>(
    `/api/admin/products/${encodeURIComponent(productId)}/images`,
    formWith(file, altText.trim() ? { altText: altText.trim() } : {}),
    { onUploadProgress: progress(onProgress) },
  )
  return response.data
}

export async function deleteProductImage(
  productId: string,
  imageId: string,
): Promise<void> {
  await http.delete(
    `/api/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
  )
}

export async function uploadCategoryImage(
  categoryId: string,
  file: File,
  onProgress?: ProgressCallback,
): Promise<Category> {
  const response = await http.put<Category>(
    `/api/admin/categories/${encodeURIComponent(categoryId)}/image`,
    formWith(file),
    { onUploadProgress: progress(onProgress) },
  )
  return response.data
}

export async function deleteCategoryImage(categoryId: string): Promise<void> {
  await http.delete(
    `/api/admin/categories/${encodeURIComponent(categoryId)}/image`,
  )
}
