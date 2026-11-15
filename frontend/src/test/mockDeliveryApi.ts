import { http } from 'msw'
import type {
  CodCollection,
  CodOverview,
  DeliveryJob,
  DeliveryStaff,
  JobUpdate,
} from '../features/delivery/deliveryApi'
import { FAILURE_REASON_LABELS } from '../features/shipping/shippingApi'
import { API, apiJson } from './apiResponses'

/** A fake delivery backend: staff accounts, jobs and cash on delivery. */

let staff: DeliveryStaff[] = []
let jobs: DeliveryJob[] = []
let cod: CodCollection[] = []

export const deliverySent: {
  staff: unknown[]
  jobUpdates: { id: string; body: JobUpdate }[]
  settlements: { ids: string[]; reference: string | null }[]
} = { staff: [], jobUpdates: [], settlements: [] }

export function resetMockDelivery() {
  staff = []
  jobs = []
  cod = []
  deliverySent.staff = []
  deliverySent.jobUpdates = []
  deliverySent.settlements = []
}

export function seedStaff(overrides: Partial<DeliveryStaff> = {}) {
  const member: DeliveryStaff = {
    id: 'staff-ravi',
    displayName: 'Ravi',
    email: 'ravi@example.com',
    enabled: true,
    activeDeliveries: 0,
    createdAt: '2026-11-15T08:00:00Z',
    ...overrides,
  }
  staff = [...staff, member]
  return member
}

export function seedJob(overrides: Partial<DeliveryJob> = {}) {
  const job: DeliveryJob = {
    id: 'job-1',
    reference: 'LD-000001',
    orderNumber: 'SD-001020',
    status: 'BOOKED',
    recipientName: 'Kamala',
    phone: '+94 77 123 4567',
    line1: '12 Temple Road',
    line2: null,
    city: 'Jaffna',
    region: null,
    postalCode: '40000',
    customerNote: 'Blue gate',
    items: [
      {
        productName: 'Palmyra jaggery',
        variantLabel: null,
        quantity: '2',
        saleUnit: 'PIECE',
      },
    ],
    cashToCollect: { amount: '1408.00', currency: 'LKR' },
    alreadyPaid: false,
    failedAttempts: [],
    canStart: true,
    canFinish: false,
    assignedAt: '2026-11-15T08:00:00Z',
    ...overrides,
  }
  jobs = [...jobs, job]
  return job
}

export function seedCod(overrides: Partial<CodCollection> = {}) {
  const c: CodCollection = {
    id: `cod-${cod.length + 1}`,
    orderNumber: 'SD-001020',
    amount: { amount: '1408.00', currency: 'LKR' },
    holderType: 'STAFF',
    holderName: 'Ravi',
    reference: 'LD-000001',
    collectedAt: '2026-11-15T09:00:00Z',
    daysHeld: 0,
    status: 'HELD',
    settledAt: null,
    settledBy: null,
    settlementReference: null,
    ...overrides,
  }
  cod = [...cod, c]
  return c
}

const problem = (status: number, detail: string) =>
  apiJson({ title: 'Error', status, detail }, { status })

function cents(amount: string) {
  const [whole, fraction = ''] = amount.split('.')
  return BigInt(whole + fraction.padEnd(2, '0').slice(0, 2))
}

function money(value: bigint) {
  const digits = value.toString().padStart(3, '0')
  return {
    amount: `${digits.slice(0, -2)}.${digits.slice(-2)}`,
    currency: 'LKR',
  }
}

function overview(): CodOverview {
  const held = cod.filter((c) => c.status === 'HELD')
  const byHolder = new Map<string, CodOverview['byHolder'][number]>()
  for (const c of held) {
    const key = `${c.holderType}|${c.holderName}`
    const before = byHolder.get(key)
    byHolder.set(key, {
      holderType: c.holderType,
      holderName: c.holderName,
      count: (before?.count ?? 0) + 1,
      amount: money(
        cents(before?.amount.amount ?? '0.00') + cents(c.amount.amount),
      ),
    })
  }
  return {
    totalHeld: money(held.reduce((s, c) => s + cents(c.amount.amount), 0n)),
    byHolder: [...byHolder.values()],
    held,
    recentlyReceived: cod.filter((c) => c.status === 'SETTLED'),
  }
}

const ADMIN = `${API}/api/admin/delivery`
const JOBS = `${API}/api/delivery/jobs`

export const deliveryHandlers = [
  http.get(`${ADMIN}/staff`, () => apiJson(staff)),
  http.post(`${ADMIN}/staff`, async ({ request }) => {
    const body = (await request.json()) as {
      displayName: string
      email: string
      password: string
    }
    deliverySent.staff.push(body)
    if (staff.some((s) => s.email === body.email.toLowerCase())) {
      return problem(
        409,
        'An account with this email already exists. Use a different email for staff.',
      )
    }
    const created = seedStaff({
      id: `staff-${staff.length + 1}`,
      displayName: body.displayName,
      email: body.email.toLowerCase(),
    })
    return apiJson(created, { status: 201 })
  }),
  http.put(`${ADMIN}/staff/:id/status`, async ({ params, request }) => {
    const { enabled } = (await request.json()) as { enabled: boolean }
    const member = staff.find((s) => s.id === params.id)!
    if (!enabled && member.activeDeliveries > 0) {
      return problem(
        400,
        `${member.displayName} still has deliveries. Give them to someone else first.`,
      )
    }
    const updated = { ...member, enabled }
    staff = staff.map((s) => (s.id === updated.id ? updated : s))
    return apiJson(updated)
  }),
  http.put(`${ADMIN}/staff/:id/password`, ({ params }) =>
    apiJson(staff.find((s) => s.id === params.id)),
  ),
  http.get(`${ADMIN}/cod`, () => apiJson(overview())),
  http.post(`${ADMIN}/cod/settle`, async ({ request }) => {
    const body = (await request.json()) as {
      ids: string[]
      reference: string | null
    }
    deliverySent.settlements.push(body)
    cod = cod.map((c) =>
      body.ids.includes(c.id)
        ? {
            ...c,
            status: 'SETTLED',
            settledAt: '2026-11-15T12:00:00Z',
            settledBy: 'owner@example.com',
            settlementReference: body.reference,
          }
        : c,
    )
    return apiJson(overview())
  }),

  http.get(JOBS, () =>
    apiJson(
      jobs.map((j) => ({
        id: j.id,
        reference: j.reference,
        orderNumber: j.orderNumber,
        status: j.status,
        recipientName: j.recipientName,
        city: j.city,
        cashToCollect: j.cashToCollect,
        failedAttempts: j.failedAttempts.length,
        assignedAt: j.assignedAt,
      })),
    ),
  ),
  http.get(`${JOBS}/:id`, ({ params }) => {
    const job = jobs.find((j) => j.id === params.id)
    return job ? apiJson(job) : problem(404, 'Delivery not found')
  }),
  http.post(`${JOBS}/:id/updates`, async ({ params, request }) => {
    const body = (await request.json()) as JobUpdate
    deliverySent.jobUpdates.push({ id: String(params.id), body })
    const job = jobs.find((j) => j.id === params.id)!
    let updated: DeliveryJob = job
    if (body.action === 'START') {
      updated = {
        ...job,
        status: 'OUT_FOR_DELIVERY',
        canStart: false,
        canFinish: true,
      }
    } else if (body.action === 'FAILED') {
      updated = {
        ...job,
        status: 'EXCEPTION',
        canStart: true,
        canFinish: false,
        failedAttempts: [
          ...job.failedAttempts,
          {
            at: '2026-11-15T10:00:00Z',
            reason: FAILURE_REASON_LABELS[body.failureReason],
            note: body.note,
          },
        ],
      }
    } else {
      updated = {
        ...job,
        status: 'DELIVERED',
        canStart: false,
        canFinish: false,
      }
      jobs = jobs.filter((j) => j.id !== job.id)
      return apiJson(updated)
    }
    jobs = jobs.map((j) => (j.id === updated.id ? updated : j))
    return apiJson(updated)
  }),
]
