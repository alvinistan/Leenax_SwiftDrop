import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/ErrorState'
import { listAdminProducts } from '../../../features/admin/adminProductApi'
import {
  getSettings,
  listMarkupRules,
  listPresets,
  listProviders,
  listRateCards,
} from '../../../features/shipping/shippingApi'
import { KpiTiles } from '../../../features/shipping/charts/KpiTiles'
import { getSummaryReport } from '../../../features/shipping/shippingApi'
import { useAsync } from '../../../hooks/useAsync'
import { userMessage } from '../../../lib/errors'

type Step = { done: boolean; title: string; detail: ReactNode; to: string }

const COMING_LATER = [
  ['Payment rules before dispatch, customer notifications', 'Shipping Phase G'],
  ['Labels and automatic booking', 'Shipping Phase D (DHL API)'],
  ['Integration logs', 'Shipping Phase D (DHL API)'],
] as const

/** Shipping set-up checklist: what is ready and what still needs the owner. */
export function ShippingOverviewPage() {
  const { state, retry } = useAsync(async (signal) => {
    const [settings, providers, cards, rules, boxes, products] =
      await Promise.all([
        getSettings(signal),
        listProviders(signal),
        listRateCards(signal),
        listMarkupRules(signal),
        listPresets(signal),
        listAdminProducts({ status: 'ACTIVE', size: 100 }, signal),
      ])
    return { settings, providers, cards, rules, boxes, products }
  }, 'shipping-overview')

  return (
    <>
      <title>Shipping | Admin</title>
      <h1 className="text-2xl font-bold text-slate-900">Shipping</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Set-up checklist. Customers can get a delivery price only when the steps
        for that destination are done.
      </p>
      <ThisMonth />
      <h2 className="mt-10 text-lg font-semibold text-slate-900">
        Set-up checklist
      </h2>
      <div className="mt-3">
        {state.status === 'loading' && (
          <p className="text-slate-600">Checking shipping set-up…</p>
        )}
        {state.status === 'error' && (
          <ErrorState description={userMessage(state.error)} onRetry={retry} />
        )}
        {state.status === 'success' && (
          <Checklist
            steps={buildSteps(state.data)}
            dhlConnected={state.data.providers.some(
              (p) => p.code === 'DHL_EXPRESS' && p.ratesSource === 'RATE_CARD',
            )}
          />
        )}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">
        Coming later
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {COMING_LATER.map(([title, when]) => (
          <li
            key={title}
            className="flex items-start gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm"
          >
            <Clock
              className="mt-0.5 size-4 text-slate-400"
              aria-hidden="true"
            />
            <span>
              <span className="font-semibold text-slate-800">{title}</span>
              <span className="block text-slate-500">{when}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

function buildSteps(data: {
  settings: Awaited<ReturnType<typeof getSettings>>
  providers: Awaited<ReturnType<typeof listProviders>>
  cards: Awaited<ReturnType<typeof listRateCards>>
  rules: Awaited<ReturnType<typeof listMarkupRules>>
  boxes: Awaited<ReturnType<typeof listPresets>>
  products: Awaited<ReturnType<typeof listAdminProducts>>
}): Step[] {
  const missingWeight = data.products.content.filter((p) => !p.shippingReady)
  const exampleBoxes = data.boxes.filter((b) => b.name.includes('(example)'))
  const domesticCard = data.cards.some(
    (c) =>
      c.enabled &&
      c.scope === 'DOMESTIC' &&
      c.countryCode === data.settings.originCountry,
  )
  const unverified = data.providers.filter((p) => p.enabled && !p.rulesVerified)
  return [
    {
      done: true,
      title: 'Pickup address',
      detail: `${data.settings.originLine1}, ${data.settings.originCity}. Import duties: ${
        data.settings.dutiesPaidBy === 'RECEIVER'
          ? 'paid by the receiver'
          : 'paid by us'
      }.`,
      to: '/admin/shipping/settings',
    },
    {
      done: missingWeight.length === 0,
      title: 'Packed weight on every active product',
      detail:
        missingWeight.length === 0
          ? 'All active products have a shipping weight.'
          : `${missingWeight.length} active product(s) have no weight: ${missingWeight
              .slice(0, 3)
              .map((p) => p.name)
              .join(', ')}${missingWeight.length > 3 ? '…' : ''}`,
      to: '/admin/products',
    },
    {
      done: data.boxes.some((b) => b.enabled) && exampleBoxes.length === 0,
      title: 'Your real box sizes',
      detail:
        exampleBoxes.length > 0
          ? `${exampleBoxes.length} example box(es) still in use. Replace them with your real boxes.`
          : 'Box sizes set up.',
      to: '/admin/shipping/settings',
    },
    {
      done: domesticCard,
      title: 'DEX price list for Sri Lanka',
      detail: domesticCard
        ? 'Domestic rate card in use.'
        : 'Enter the DEX price list so customers in Sri Lanka get delivery prices.',
      to: '/admin/shipping/rate-cards',
    },
    {
      done: unverified.length === 0,
      title: 'Courier weight rules confirmed',
      detail:
        unverified.length === 0
          ? 'All couriers in use are confirmed.'
          : `Confirm the volumetric divisor and rounding with: ${unverified.map((p) => p.name).join(', ')}.`,
      to: '/admin/shipping/providers',
    },
    {
      done: data.rules.some((r) => r.activeNow),
      title: 'Platform fee',
      detail: data.rules.some((r) => r.activeNow)
        ? data.rules
            .filter((r) => r.activeNow)
            .map((r) => r.description)
            .join('; ')
        : 'No active rule: customers pay the courier price only.',
      to: '/admin/shipping/markup',
    },
  ]
}

function Checklist({
  steps,
  dhlConnected,
}: {
  steps: Step[]
  dhlConnected: boolean
}) {
  return (
    <Card>
      <ol className="divide-y divide-slate-100">
        {steps.map((step) => (
          <li key={step.title} className="flex items-start gap-3 p-4">
            {step.done ? (
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
            ) : (
              <Circle
                className="mt-0.5 size-5 shrink-0 text-amber-600"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {step.title}{' '}
                <span className="sr-only">
                  {step.done ? '(done)' : '(to do)'}
                </span>
              </p>
              <p className="text-sm text-slate-600">{step.detail}</p>
            </div>
            <Link
              to={step.to}
              className="shrink-0 text-sm font-semibold text-brand-800 hover:underline"
            >
              Open <span className="sr-only">{step.title}</span>
            </Link>
          </li>
        ))}
        <li className="flex items-start gap-3 p-4">
          <Clock
            className="mt-0.5 size-5 shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold text-slate-900">
              International (DHL Express)
            </p>
            <p className="text-sm text-slate-600">
              {dhlConnected
                ? 'Using a DHL rate card that you entered.'
                : 'Waiting for a DHL account and API access (Shipping Phase D). Until then, customers abroad are asked to contact you.'}
            </p>
          </div>
        </li>
      </ol>
    </Card>
  )
}

/** This month so far: the headline numbers, with a link to the full reports. */
function ThisMonth() {
  const [period] = useState(() => {
    const today = new Date()
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return {
      from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: iso(today),
    }
  })
  const { state } = useAsync(
    (signal) => getSummaryReport(period.from, period.to, 'DAY', signal),
    `overview-${period.from}`,
  )
  return (
    <section aria-labelledby="this-month" className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="this-month" className="text-lg font-semibold text-slate-900">
          This month so far
        </h2>
        <Link
          to="/admin/shipping/reports"
          className="text-sm font-semibold text-brand-800 hover:underline"
        >
          Open reports
        </Link>
      </div>
      <div className="mt-3">
        {state.status === 'loading' && (
          <p className="text-slate-600">Loading…</p>
        )}
        {state.status === 'error' && (
          <p className="text-sm text-red-700">{userMessage(state.error)}</p>
        )}
        {state.status === 'success' && <KpiTiles totals={state.data.totals} />}
      </div>
    </section>
  )
}
