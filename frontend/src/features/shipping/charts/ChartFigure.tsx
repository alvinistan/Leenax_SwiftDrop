import { useId, type ReactNode } from 'react'

type Props = {
  title: string
  /** One sentence for screen readers describing what the chart shows. */
  summary: string
  /** The same numbers as a table (shown under "Show the numbers"). */
  table: ReactNode
  children: ReactNode
  note?: ReactNode
  /** Plot height in pixels (default 256). */
  height?: number
}

/**
 * A chart with its title, an accessible summary and a table of the same
 * numbers, so nothing depends on seeing the colours or the shapes.
 */
export function ChartFigure({
  title,
  summary,
  table,
  children,
  note,
  height = 256,
}: Props) {
  const titleId = useId()
  return (
    <figure
      aria-labelledby={titleId}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <figcaption id={titleId} className="font-semibold text-slate-900">
        {title}
      </figcaption>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
      <div role="img" aria-label={summary} className="mt-3" style={{ height }}>
        {children}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-medium text-brand-800">
          Show the numbers
        </summary>
        <div className="mt-2 max-h-72 overflow-auto">{table}</div>
      </details>
    </figure>
  )
}
