import { http } from '../../api/http'
import type { Money, SaleUnit } from '../../types/catalog'
import type { FailureReason, TrackingStatus } from '../shipping/shippingApi'

// ---- delivery staff pages (role DELIVERY): only their own parcels ----

export type DeliveryJobSummary = {
  id: string
  /** Our reference, e.g. LD-000012 */
  reference: string
  orderNumber: string
  status: TrackingStatus
  recipientName: string | null
  city: string | null
  /** Cash to collect from the customer, or null (already paid). */
  cashToCollect: Money | null
  failedAttempts: number
  assignedAt: string
}

export type DeliveryJob = {
  id: string
  reference: string
  orderNumber: string
  status: TrackingStatus
  recipientName: string | null
  phone: string | null
  line1: string | null
  line2: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  customerNote: string | null
  items: {
    productName: string
    variantLabel: string | null
    quantity: string
    saleUnit: SaleUnit
  }[]
  cashToCollect: Money | null
  alreadyPaid: boolean
  failedAttempts: { at: string; reason: string; note: string | null }[]
  /** "Start delivery" is possible */
  canStart: boolean
  /** Out for delivery: "Delivered" or "Could not deliver" */
  canFinish: boolean
  assignedAt: string
}

export type JobUpdate =
  | { action: 'START' }
  | {
      action: 'DELIVERED'
      receivedBy: string
      cashCollected: boolean
      note: string | null
    }
  | { action: 'FAILED'; failureReason: FailureReason; note: string | null }

const JOBS = '/api/delivery/jobs'

export async function getMyJobs(signal?: AbortSignal) {
  return (await http.get<DeliveryJobSummary[]>(JOBS, { signal })).data
}

export async function getMyJob(jobId: string, signal?: AbortSignal) {
  return (
    await http.get<DeliveryJob>(`${JOBS}/${encodeURIComponent(jobId)}`, {
      signal,
    })
  ).data
}

export async function updateJob(jobId: string, update: JobUpdate) {
  return (
    await http.post<DeliveryJob>(
      `${JOBS}/${encodeURIComponent(jobId)}/updates`,
      update,
    )
  ).data
}

// ---- admin: staff accounts and cash on delivery ----

export type DeliveryStaff = {
  id: string
  displayName: string
  email: string
  enabled: boolean
  activeDeliveries: number
  createdAt: string
}

const ADMIN = '/api/admin/delivery'

export async function listStaff(signal?: AbortSignal) {
  return (await http.get<DeliveryStaff[]>(`${ADMIN}/staff`, { signal })).data
}

export async function createStaff(input: {
  displayName: string
  email: string
  password: string
}) {
  return (await http.post<DeliveryStaff>(`${ADMIN}/staff`, input)).data
}

export async function setStaffEnabled(staffId: string, enabled: boolean) {
  return (
    await http.put<DeliveryStaff>(
      `${ADMIN}/staff/${encodeURIComponent(staffId)}/status`,
      { enabled },
    )
  ).data
}

export async function resetStaffPassword(staffId: string, password: string) {
  return (
    await http.put<DeliveryStaff>(
      `${ADMIN}/staff/${encodeURIComponent(staffId)}/password`,
      { password },
    )
  ).data
}

export type CodHolderType = 'COURIER' | 'STAFF'

export type CodCollection = {
  id: string
  orderNumber: string
  amount: Money
  holderType: CodHolderType
  holderName: string
  /** The parcel's tracking number / reference */
  reference: string
  collectedAt: string
  daysHeld: number
  status: 'HELD' | 'SETTLED'
  settledAt: string | null
  settledBy: string | null
  settlementReference: string | null
}

export type CodOverview = {
  totalHeld: Money
  byHolder: {
    holderType: CodHolderType
    holderName: string
    count: number
    amount: Money
  }[]
  held: CodCollection[]
  recentlyReceived: CodCollection[]
}

export async function getCodOverview(signal?: AbortSignal) {
  return (await http.get<CodOverview>(`${ADMIN}/cod`, { signal })).data
}

/** The courier or staff member handed over the cash: the orders become paid. */
export async function settleCod(ids: string[], reference: string | null) {
  return (
    await http.post<CodOverview>(`${ADMIN}/cod/settle`, { ids, reference })
  ).data
}
