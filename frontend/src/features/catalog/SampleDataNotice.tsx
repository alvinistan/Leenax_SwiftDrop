import { Info } from 'lucide-react'
import { USING_SAMPLE_DATA } from './catalogApi'

/** The "these are samples" banner. Disappears automatically once real data is used. */
export function SampleDataNotice() {
  if (!USING_SAMPLE_DATA) return null
  return (
    <p className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        <strong>Preview:</strong> these products are samples for design
        purposes. They are not for sale, and prices are not real.
      </span>
    </p>
  )
}
