import { http } from '../../api/http'

export type TaxRate = {
  id: string
  name: string
  /** Decimal string, e.g. "18" */
  percent: string
  productCount: number
}

export async function listTaxRates(signal?: AbortSignal) {
  return (await http.get<TaxRate[]>('/api/admin/tax-rates', { signal })).data
}

export async function createTaxRate(input: { name: string; percent: string }) {
  return (await http.post<TaxRate>('/api/admin/tax-rates', input)).data
}

export async function updateTaxRate(
  id: string,
  input: { name: string; percent: string },
) {
  return (
    await http.put<TaxRate>(
      `/api/admin/tax-rates/${encodeURIComponent(id)}`,
      input,
    )
  ).data
}

export async function deleteTaxRate(id: string) {
  await http.delete(`/api/admin/tax-rates/${encodeURIComponent(id)}`)
}
