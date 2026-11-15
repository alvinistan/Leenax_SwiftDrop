import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  addMockStaffAccount,
  logInMockAdmin,
  logInMockCustomer,
  logInMockStaff,
} from './test/mockAdminApi'
import {
  deliverySent,
  seedCod,
  seedJob,
  seedStaff,
} from './test/mockDeliveryApi'
import { seedShipment, sent } from './test/mockShippingApi'
import { seedAdminOrder } from './test/mockShopApi'
import { renderRoute } from './test/renderRoute'

describe('delivery staff pages', () => {
  it('lists only my deliveries with the cash to collect', async () => {
    logInMockStaff()
    seedJob()
    renderRoute('/delivery')

    const link = await screen.findByRole('link', { name: /Kamala/ })
    expect(within(link).getByText(/Collect/)).toHaveTextContent('1,408.00')
    expect(within(link).getByText(/LD-000001/)).toBeInTheDocument()
  })

  it('starts, then delivers with the receiver and the cash confirmed', async () => {
    logInMockStaff()
    seedJob()
    renderRoute('/delivery/job-1')

    expect(
      await screen.findByRole('link', { name: /Call \+94 77 123 4567/ }),
    ).toHaveAttribute('href', 'tel:+94771234567')
    expect(screen.getByText(/Blue gate/)).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Start delivery' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delivered' }),
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm delivery' }),
    )
    expect(
      await screen.findByText(
        'Enter the name of the person who took the parcel.',
      ),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Received by'), 'Kamala')
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm delivery' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(/Collect/)

    await userEvent.click(
      screen.getByRole('checkbox', { name: /I collected .*1,408\.00 in cash/ }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm delivery' }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Order SD-001020 delivered\. Hand the .*1,408\.00 to the owner\./,
    )
    // The address is gone from the page once delivered
    expect(screen.queryByText('12 Temple Road')).not.toBeInTheDocument()
    expect(deliverySent.jobUpdates.map((u) => u.body)).toEqual([
      { action: 'START' },
      {
        action: 'DELIVERED',
        receivedBy: 'Kamala',
        cashCollected: true,
        note: null,
      },
    ])
  })

  it('records a failed attempt with its reason', async () => {
    logInMockStaff()
    seedJob({ status: 'OUT_FOR_DELIVERY', canStart: false, canFinish: true })
    renderRoute('/delivery/job-1')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Could not deliver' }),
    )
    await userEvent.selectOptions(
      screen.getByLabelText('What happened?'),
      'Other reason',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save attempt' }))
    expect(
      await screen.findByText('Describe what happened.'),
    ).toBeInTheDocument()

    await userEvent.selectOptions(
      screen.getByLabelText('What happened?'),
      'Nobody was at home',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save attempt' }))
    expect(
      await screen.findByRole('heading', { name: 'Earlier attempts' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Nobody was at home/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start delivery' })).toBeEnabled()
    expect(deliverySent.jobUpdates[0].body).toEqual({
      action: 'FAILED',
      failureReason: 'NOT_AT_HOME',
      note: null,
    })
  })

  it('keeps customers out of the delivery pages', async () => {
    logInMockCustomer()
    renderRoute('/delivery')
    expect(
      await screen.findByRole('heading', { name: 'Access denied' }),
    ).toBeInTheDocument()
  })
})

describe('delivery management (admin)', () => {
  it('adds a staff member and explains why one cannot be disabled', async () => {
    logInMockAdmin()
    seedStaff({ activeDeliveries: 2 })
    renderRoute('/admin/delivery/staff')

    expect(await screen.findByText(/2 to deliver/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Disable' }))
    expect(
      await screen.findByText(/Ravi still has deliveries/),
    ).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Name'), 'Nila')
    await userEvent.type(
      screen.getByLabelText('Email (their login)'),
      'nila@example.com',
    )
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(
      screen.getByRole('button', { name: 'Add staff member' }),
    )
    expect(
      await screen.findByText('Use a password of 12 to 128 characters.'),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Password'), '-but-longer-now')
    await userEvent.click(
      screen.getByRole('button', { name: 'Add staff member' }),
    )
    expect(await screen.findByText(/Nila added/)).toBeInTheDocument()
    expect(
      screen.getByText(/nila@example\.com · 0 to deliver/),
    ).toBeInTheDocument()
  })

  it('marks cash on delivery as received', async () => {
    logInMockAdmin()
    seedCod()
    seedCod({
      orderNumber: 'SD-001021',
      holderType: 'COURIER',
      holderName: 'DEX',
      reference: 'DX123456',
      amount: { amount: '500.50', currency: 'LKR' },
      daysHeld: 4,
    })
    renderRoute('/admin/delivery/cod')

    expect(
      await screen.findByText('Cash still owed to you'),
    ).toBeInTheDocument()
    expect(screen.getByText(/1,908\.50/)).toBeInTheDocument()
    expect(screen.getByText('4 days ago')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Cash for SD-001021 received' }),
    )
    await userEvent.type(
      screen.getByLabelText('Reference (optional)'),
      'DEX remittance 77',
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Mark .*500\.50 received/ }),
    )
    expect(
      await screen.findByText('1 order(s) marked as paid.'),
    ).toBeInTheDocument()
    expect(deliverySent.settlements).toEqual([
      { ids: ['cod-2'], reference: 'DEX remittance 77' },
    ])
    const received = screen.getByRole('region', { name: 'Recently received' })
    expect(within(received).getByText('DEX remittance 77')).toBeInTheDocument()
  })

  it('gives an own delivery to a staff member and needs the receiver', async () => {
    logInMockAdmin()
    seedStaff()
    seedShipment({
      providerId: 'prov-own',
      providerCode: 'OWN_DELIVERY',
      providerName: 'SwiftDrop own delivery',
      awb: 'LD-000007',
      staffDelivery: true,
      status: 'OUT_FOR_DELIVERY',
      allowedNextStatuses: ['OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION'],
      cashToCollect: { amount: '1408.00', currency: 'LKR' },
    })
    renderRoute('/admin/shipping/shipments/ship-1')

    expect(await screen.findByText('Our reference')).toBeInTheDocument()
    expect(screen.getByText('Cash to collect on delivery')).toBeInTheDocument()
    await userEvent.selectOptions(
      await screen.findByLabelText('Staff member'),
      'staff-ravi',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Given to Ravi.')).toBeInTheDocument()
    expect(sent.assignments).toEqual([
      { shipmentId: 'ship-1', userId: 'staff-ravi' },
    ])

    await userEvent.selectOptions(
      screen.getByLabelText('New status'),
      'DELIVERED',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add update' }))
    expect(
      await screen.findByText('Enter who received the parcel.'),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Received by'), 'Kamala')
    await userEvent.click(screen.getByRole('button', { name: 'Add update' }))
    // Delivered is final: the form is replaced, and the timeline shows the receiver
    expect(await screen.findByText('Received by Kamala')).toBeInTheDocument()
    expect(sent.tracking[0]).toMatchObject({
      status: 'DELIVERED',
      receivedBy: 'Kamala',
      failureReason: null,
    })
  })

  it('limits a Sri Lanka service to postal codes', async () => {
    logInMockAdmin()
    renderRoute('/admin/shipping/providers')

    const area = await screen.findByLabelText(
      'Postal codes Local delivery by our staff covers (optional)',
    )
    await userEvent.type(area, '40000, 40 010')
    await userEvent.click(
      screen.getByRole('button', { name: 'Save SwiftDrop own delivery' }),
    )
    expect(
      await screen.findByText('SwiftDrop own delivery saved.'),
    ).toBeInTheDocument()
    expect(area).toHaveValue('40000, 40010')
    // No tracking-link field for our own staff
    const card = area.closest('form')!
    expect(
      within(card).queryByLabelText('Tracking link format (optional)'),
    ).not.toBeInTheDocument()
  })

  it('shows customers a failed attempt and who received the parcel', async () => {
    logInMockCustomer()
    seedAdminOrder({
      orderNumber: 'SD-001030',
      status: 'DELIVERED',
      shipments: [
        {
          id: 'ship-5',
          providerName: 'SwiftDrop own delivery',
          serviceName: null,
          awb: 'LD-000005',
          status: 'DELIVERED',
          trackingUrl: null,
          steps: [
            {
              status: 'EXCEPTION',
              at: '2026-11-15T09:00:00Z',
              location: null,
              failedBecause: 'Nobody was at home',
              receivedBy: null,
            },
            {
              status: 'DELIVERED',
              at: '2026-11-15T15:00:00Z',
              location: null,
              failedBecause: null,
              receivedBy: 'Kamala',
            },
          ],
        },
      ],
    })
    renderRoute('/account/orders/SD-001030')

    const steps = await screen.findByRole('list', {
      name: 'Tracking steps for LD-000005',
    })
    expect(
      within(steps).getByText(/Delivery attempt failed: Nobody was at home/),
    ).toBeInTheDocument()
    expect(within(steps).getByText(/received by Kamala/)).toBeInTheDocument()
  })
})

describe('logging in as staff', () => {
  it('goes to my deliveries', async () => {
    addMockStaffAccount()
    seedJob()
    renderRoute('/login')
    await userEvent.type(
      await screen.findByLabelText('Email address'),
      'ravi@example.com',
    )
    await userEvent.type(
      screen.getByLabelText('Password'),
      'a-long-staff-password',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'My deliveries' }),
      ).toBeInTheDocument(),
    )
  })
})
