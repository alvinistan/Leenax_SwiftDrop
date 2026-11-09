/** Shown while a lazily loaded page's code is downloading (e.g. opening /admin directly). */
export function PageLoading() {
  return (
    <p role="status" className="p-8 text-center text-slate-600">
      Loading…
    </p>
  )
}
