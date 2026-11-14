import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { logInMockAdmin } from './test/mockAdminApi'
import { seedShipment, sent } from './test/mockShippingApi'
import { renderRoute } from './test/renderRoute'

describe('shipments (manual booking and tracking)', () => {
  it('records a parcel booked on the DEX portal', async () => {
    logInMockAdmin()
    const router = renderRoute('/admin/shipping/shipments')

    expect(await screen.findByText('No shipments yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Record shipment/ }))

    // Only DEX is on, so it is chosen already (DHL is off in the test data)
    const courier = await screen.findByLabelText('Courier')
    expect(
      within(courier).queryByRole('option', { name: 'DHL Express' }),
    ).toBeNull()
    expect(courier).toHaveValue('prov-dex')

    await userEvent.type(
      screen.getByLabelText('Tracking number (AWB)'),
      'dex-778899',
    )
    await userEvent.type(screen.getByLabelText('Order reference'), 'WA-2001')
    await userEvent.type(
      screen.getByLabelText('Destination city (optional)'),
      'Kandy',
    )
    await userEvent.type(
      screen.getByLabelText('Courier charge (LKR, optional)'),
      '450',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Record shipment' }),
    )

    expect(
      await screen.findByRole('heading', { name: /Order WA-2001/ }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(
      '/admin/shipping/shipments/ship-1',
    )
    expect(screen.getByText('DEX-778899')).toBeInTheDocument()
    expect(sent.shipments[0]).toMatchObject({
      providerId: 'prov-dex',
      bookedAt: null,
      details: {
        awb: 'dex-778899',
        orderReference: 'WA-2001',
        destinationCountry: 'LK',
        destinationCity: 'Kandy',
        courierCost: '450',
        weightKg: null,
      },
    })
  })

  it('checks the tracking number before sending', async () => {
    logInMockAdmin()
    renderRoute('/admin/shipping/shipments/new')

    await userEvent.type(
      await screen.findByLabelText('Tracking number (AWB)'),
      'AB 1',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Record shipment' }),
    )

    expect(
      screen.getByLabelText('Tracking number (AWB)'),
    ).toHaveAccessibleDescription(
      'Enter the tracking number (AWB): 4 to 40 letters, digits or hyphens.',
    )
    expect(
      screen.getByLabelText('Order reference'),
    ).toHaveAccessibleDescription(/Order reference is required/)
    expect(sent.shipments).toHaveLength(0)
  })

  it('shows the server message for a tracking number already recorded', async () => {
    logInMockAdmin()
    seedShipment({ awb: 'DEX12345' })
    renderRoute('/admin/shipping/shipments/new')

    await userEvent.type(
      await screen.findByLabelText('Tracking number (AWB)'),
      'DEX12345',
    )
    await userEvent.type(screen.getByLabelText('Order reference'), 'WA-9')
    await userEvent.click(
      screen.getByRole('button', { name: 'Record shipment' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This DEX tracking number is already recorded.',
    )
  })

  it('offers only the allowed next statuses and adds an update', async () => {
    logInMockAdmin()
    const shipment = seedShipment({
      status: 'PICKED_UP',
      allowedNextStatuses: [
        'IN_TRANSIT',
        'CUSTOMS_CLEARANCE',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'EXCEPTION',
        'RETURNED',
      ],
    })
    renderRoute(`/admin/shipping/shipments/${shipment.id}`)

    const status = await screen.findByLabelText('New status')
    // A collected parcel can no longer be cancelled
    expect(
      within(status).queryByRole('option', { name: 'Cancelled' }),
    ).toBeNull()

    await userEvent.selectOptions(status, 'IN_TRANSIT')
    await userEvent.type(
      screen.getByLabelText('Location (optional)'),
      'Colombo hub',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add update' }))

    expect(
      await screen.findByText('Status changed to in transit.'),
    ).toBeInTheDocument()
    const history = screen.getByRole('region', { name: 'Tracking history' })
    expect(within(history).getByText('Colombo hub')).toBeInTheDocument()
    expect(sent.tracking[0]).toEqual({
      status: 'IN_TRANSIT',
      occurredAt: null,
      location: 'Colombo hub',
      note: null,
    })
  })

  it('takes no more updates after delivery and links to the courier site', async () => {
    logInMockAdmin()
    const shipment = seedShipment({
      status: 'DELIVERED',
      allowedNextStatuses: [],
      trackingUrl: 'https://track.example/t?awb=DEX12345',
    })
    renderRoute(`/admin/shipping/shipments/${shipment.id}`)

    expect(
      await screen.findByText(/no more updates can be added/),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('New status')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Track on DEX's website/ }),
    ).toHaveAttribute('href', 'https://track.example/t?awb=DEX12345')
  })

  it('searches by AWB or order reference', async () => {
    logInMockAdmin()
    seedShipment({ awb: 'DEX11111', orderReference: 'WA-1' })
    seedShipment({ awb: 'DEX22222', orderReference: 'WA-2' })
    renderRoute('/admin/shipping/shipments')

    expect(
      await screen.findByRole('link', { name: 'WA-1' }),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Search'), '22222')
    await userEvent.click(screen.getByRole('button', { name: /Search/ }))

    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: 'WA-1' }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: 'WA-2' })).toBeInTheDocument()
  })
})
