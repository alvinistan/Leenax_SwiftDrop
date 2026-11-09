import { http } from '../../api/http'
import type { Category } from '../../types/catalog'

/** What the admin form sends (the backend's CategoryRequest). */
export type CategoryInput = {
  name: string
  slug: string
  description: string | null
  sortOrder: number
  active: boolean
}

/*
 * Admin endpoints. They need an ADMIN login: the session cookie and the CSRF
 * header are added automatically by the shared Axios instance.
 */

export async function listAllCategories(
  signal?: AbortSignal,
): Promise<Category[]> {
  return (await http.get<Category[]>('/api/admin/categories', { signal })).data
}

export async function getCategory(
  id: string,
  signal?: AbortSignal,
): Promise<Category> {
  return (
    await http.get<Category>(
      `/api/admin/categories/${encodeURIComponent(id)}`,
      { signal },
    )
  ).data
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  return (await http.post<Category>('/api/admin/categories', input)).data
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<Category> {
  return (
    await http.put<Category>(
      `/api/admin/categories/${encodeURIComponent(id)}`,
      input,
    )
  ).data
}

export async function deleteCategory(id: string): Promise<void> {
  await http.delete(`/api/admin/categories/${encodeURIComponent(id)}`)
}
