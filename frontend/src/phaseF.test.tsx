import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { logInMockAdmin, logInMockCustomer } from './test/mockAdminApi'
import { seedShipment, sent } from './test/mockShippingApi'
import { seedAdminOrder } from './test/mockShopApi'
import { renderRoute } from './test/renderRoute'

const dexParcel = {
  id: 'ship-9',
  providerName: 'DEX',
  serviceName: 'Standard',
  awb: 'DEX778899',
  status: 'IN_TRANSIT',
  trackingUrl: 'https://track.example/t?awb=DEX778899',
  steps: [
    { status: 'BOOKED', at: '2026-11-14T08:00:00Z', location: null },
    {
      status: 'IN_TRANSIT',
      at: '2026-11-14T12:00:00Z',
      location: 'Colombo hub',
    },
  ],
}

describe('shipments linked to orders', () => {
  it('records the parcel of a confirmed order with its details filled in', async () => {
    logInMockAdmin()
    seedAdminOrder({
      orderNumber: 'SD-001010',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      allowedNextStatuses: ['SHIPPED', 'CANCELLED'],
    })
    const router = renderRoute('/admin/orders/SD-001010')

    await userEvent.click(
      await screen.findByRole('link', { name: 'Record shipment' }),
    )

    expect(await screen.findByLabelText('Order reference')).toHaveValue(
      'SD-001010',
    )
    expect(screen.getByLabelText('Order reference')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Courier')).toHaveValue('prov-dex')
    expect(screen.getByLabelText('Destination city (optional)')).toHaveValue(
      'Jaffna',
    )
    expect(screen.getByLabelText('Parcel weight (kg, optional)')).toHaveValue(
      '2',
    )
    await userEvent.type(
      screen.getByLabelText('Tracking number (AWB)'),
      'DEX55501',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Record shipment' }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(
        /^\/admin\/shipping\/shipments\/ship-/,
      ),
    )
    expect(sent.shipments[0]).toMatchObject({
      providerId: 'prov-dex',
      orderNumber: 'SD-001010',
      details: {
        orderReference: 'SD-001010',
        destinationCountry: 'LK',
        weightKg: '2',
      },
    })
  })

  it('asks to confirm the order before booking', async () => {
    logInMockAdmin()
    seedAdminOrder({ orderNumber: 'SD-001011' })
    renderRoute('/admin/orders/SD-001011')

    expect(
      await screen.findByText('Confirm the order first.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Record shipment' }),
    ).not.toBeInTheDocument()
  })

  it('shows customers where their parcel is', async () => {
    logInMockCustomer()
    seedAdminOrder({
      orderNumber: 'SD-001012',
      status: 'SHIPPED',
      shipments: [dexParcel],
    })
    renderRoute('/account/orders/SD-001012')

    const tracking = await screen.findByRole('region', {
      name: 'Delivery tracking',
    })
    expect(within(tracking).getByText('DEX778899')).toBeInTheDocument()
    expect(within(tracking).getByText(/Colombo hub/)).toBeInTheDocument()
    expect(
      within(tracking).getByRole('link', { name: /Track on DEX's website/ }),
    ).toHaveAttribute('href', 'https://track.example/t?awb=DEX778899')
  })
})

describe('courier charges', () => {
  it('adds an extra charge to a shipment', async () => {
    logInMockAdmin()
    const shipment = seedShipment({
      orderNumber: 'SD-001010',
      orderReference: 'SD-001010',
      courierCost: { amount: '550.00', currency: 'LKR' },
      totalCourierCost: { amount: '550.00', currency: 'LKR' },
      deliveryCharged: { amount: '561.00', currency: 'LKR' },
    })
    renderRoute(`/admin/shipping/shipments/${shipment.id}`)

    expect(
      await screen.findByRole('link', { name: 'SD-001010' }),
    ).toHaveAttribute('href', '/admin/orders/SD-001010')
    expect(
      screen.getByText(/customer paid LKR\s561\.00 for delivery/),
    ).toBeInTheDocument()

    const charges = screen.getByRole('region', { name: 'Courier charges' })
    await userEvent.type(within(charges).getByLabelText('Amount (LKR)'), '100')
    await userEvent.type(
      within(charges).getByLabelText('Invoice number (optional)'),
      'INV-7',
    )
    await userEvent.click(
      within(charges).getByRole('button', { name: 'Add charge' }),
    )

    expect(
      await within(charges).findByText('Charge added.'),
    ).toBeInTheDocument()
    expect(within(charges).getByText(/650\.00/)).toBeInTheDocument()
    expect(sent.expenses[0]).toEqual({
      kind: 'SURCHARGE',
      amount: '100',
      reference: 'INV-7',
      incurredOn: null,
      note: null,
    })
  })

  it('reports the gross shipping margin and missing charges', async () => {
    logInMockAdmin()
    renderRoute('/admin/shipping/expenses?from=2026-11-01&to=2026-11-30')

    expect(
      await screen.findByText(/1 shipment\(s\) have no courier charge yet/),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Gross shipping margin').nextSibling,
    ).toHaveTextContent(/-?LKR\s-?39\.00|-39\.00/)
    expect(screen.getByText(/not net profit/)).toBeInTheDocument()
    expect(screen.getByText('Not entered')).toBeInTheDocument()
    expect(sent.reports[0]).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  })
})

describe('tracking list', () => {
  it('lists only parcels on their way and flags old updates', async () => {
    logInMockAdmin()
    seedShipment({
      orderReference: 'WA-OLD',
      status: 'IN_TRANSIT',
      createdAt: '2026-01-01T08:00:00Z',
    })
    seedShipment({
      orderReference: 'WA-DONE',
      awb: 'DEX99999',
      status: 'DELIVERED',
    })
    renderRoute('/admin/shipping/tracking')

    const item = (await screen.findByRole('link', { name: /WA-OLD/ })).closest(
      'li',
    )!
    expect(within(item).getByText(/No update for \d+ days/)).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /WA-DONE/ }),
    ).not.toBeInTheDocument()
  })
})
