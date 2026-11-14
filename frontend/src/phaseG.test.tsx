import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { logInMockAdmin } from './test/mockAdminApi'
import { sent } from './test/mockShippingApi'
import { seedAdminOrder } from './test/mockShopApi'
import { renderRoute } from './test/renderRoute'

describe('dispatch rules', () => {
  it('holds an unpaid order and lets the owner ship it with a reason', async () => {
    logInMockAdmin()
    seedAdminOrder({
      orderNumber: 'SD-001020',
      status: 'CONFIRMED',
      allowedNextStatuses: ['SHIPPED', 'CANCELLED'],
    })
    const router = renderRoute('/admin/orders/SD-001020')

    const check = await screen.findByRole('group', { name: 'Ready to ship?' })
    expect(
      within(check).getByText(/Payment has not been received/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Record shipment' }),
    ).not.toBeInTheDocument()

    await userEvent.click(
      within(check).getByRole('link', {
        name: 'Ship before payment (with a reason)',
      }),
    )
    await userEvent.type(
      await screen.findByLabelText('Tracking number (AWB)'),
      'DEX20001',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Record shipment' }),
    )
    expect(
      screen.getByLabelText('Why ship before payment?'),
    ).toHaveAccessibleDescription(/Write why this order ships before payment/)
    expect(sent.shipments).toHaveLength(0)

    await userEvent.type(
      screen.getByLabelText('Why ship before payment?'),
      'Trusted repeat customer',
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
      orderNumber: 'SD-001020',
      shipBeforePaymentReason: 'Trusted repeat customer',
    })
  })

  it('offers shipping straight away once the order is paid', async () => {
    logInMockAdmin()
    seedAdminOrder({
      orderNumber: 'SD-001021',
      status: 'CONFIRMED',
      allowedNextStatuses: ['SHIPPED', 'CANCELLED'],
    })
    renderRoute('/admin/orders/SD-001021')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as paid' }),
    )
    expect(
      await screen.findByRole('link', { name: 'Record shipment' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Ready to ship: book the parcel/),
    ).toBeInTheDocument()
  })
})

describe('dispatch page', () => {
  it('sorts orders into ready, waiting and to confirm', async () => {
    logInMockAdmin()
    seedAdminOrder({ orderNumber: 'SD-001030' }) // placed
    seedAdminOrder({ orderNumber: 'SD-001031', status: 'CONFIRMED' }) // unpaid
    seedAdminOrder({
      orderNumber: 'SD-001032',
      status: 'CONFIRMED',
      paymentMethod: 'COD',
    })
    renderRoute('/admin')

    await userEvent.click(await screen.findByRole('link', { name: 'Dispatch' }))

    const ready = await screen.findByRole('region', { name: 'Ready to ship' })
    expect(
      within(ready).getByRole('link', { name: 'SD-001032' }),
    ).toBeInTheDocument()
    expect(
      within(ready).getByRole('link', {
        name: 'Record shipment for SD-001032',
      }),
    ).toHaveAttribute('href', '/admin/shipping/shipments/new?order=SD-001032')
    const waiting = screen.getByRole('region', { name: 'Waiting' })
    expect(
      within(waiting).getByRole('link', { name: 'SD-001031' }),
    ).toBeInTheDocument()
    expect(
      within(waiting).getByText(/Payment has not been received/),
    ).toBeInTheDocument()
    const toConfirm = screen.getByRole('region', { name: 'To confirm' })
    expect(
      within(toConfirm).getByRole('link', { name: 'SD-001030' }),
    ).toBeInTheDocument()
  })
})
