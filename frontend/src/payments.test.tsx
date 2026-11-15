import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { submitToPayHere } from './features/payments/paymentsApi'
import { logInMockAdmin, logInMockCustomer } from './test/mockAdminApi'
import {
  enableCardPayments,
  seedAdminOrder,
  seedShopVariant,
  shopSent,
  updateMockOrder,
} from './test/mockShopApi'
import { renderRoute } from './test/renderRoute'

/** Catches the form the page would post to PayHere (jsdom cannot navigate). */
function spyOnFormSubmit() {
  const sent: { action: string; fields: Record<string, string> }[] = []
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (
    this: HTMLFormElement,
  ) {
    sent.push({
      action: this.action,
      fields: Object.fromEntries(
        Array.from(this.querySelectorAll('input')).map((i) => [
          i.name,
          i.value,
        ]),
      ),
    })
  })
  return sent
}

afterEach(() => {
  vi.restoreAllMocks()
})

async function reachPayment() {
  await userEvent.type(await screen.findByLabelText('Recipient name'), 'Kamala')
  await userEvent.type(screen.getByLabelText('Phone number'), '+94 77 123 4567')
  await userEvent.type(screen.getByLabelText('Address'), '12 Temple Road')
  await userEvent.type(screen.getByLabelText('City / town'), 'Jaffna')
  await userEvent.click(
    screen.getByRole('button', { name: /Show delivery options/ }),
  )
  await userEvent.click(await screen.findByRole('radio', { name: /DEX/ }))
}

describe('card payments (PayHere)', () => {
  it('pays by card: places the order, then posts the signed form to PayHere', async () => {
    logInMockCustomer()
    enableCardPayments()
    seedShopVariant({ variantId: 'v-toffee', codAllowed: false })
    localStorage.setItem(
      'swiftdrop-cart-v1',
      JSON.stringify([{ variantId: 'v-toffee', quantity: '1' }]),
    )
    const posted = spyOnFormSubmit()
    renderRoute('/checkout')

    await reachPayment()
    await userEvent.click(
      screen.getByRole('radio', { name: 'Pay online by card (PayHere)' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0].action).toBe('https://sandbox.payhere.lk/pay/checkout')
    expect(posted[0].fields).toMatchObject({
      merchant_id: '1211149',
      order_id: 'SD-001001',
      hash: 'ABC',
    })
    expect(shopSent.orders[0].body.paymentMethod).toBe('CARD')
    expect(
      screen.getByText('Taking you to PayHere to pay securely…'),
    ).toBeInTheDocument()
  })

  it('does not offer card payment when PayHere is not set up', async () => {
    logInMockCustomer()
    seedShopVariant({ variantId: 'v-toffee' })
    localStorage.setItem(
      'swiftdrop-cart-v1',
      JSON.stringify([{ variantId: 'v-toffee', quantity: '1' }]),
    )
    renderRoute('/checkout')

    await reachPayment()
    expect(
      screen.queryByRole('radio', { name: /Pay online by card/ }),
    ).not.toBeInTheDocument()
  })

  it('lets the customer pay later from the order page', async () => {
    logInMockCustomer()
    enableCardPayments()
    seedAdminOrder({ orderNumber: 'SD-001040', paymentMethod: 'CARD' })
    const posted = spyOnFormSubmit()
    renderRoute('/account/orders/SD-001040?payment=cancelled')

    expect(
      await screen.findByText(/The payment was cancelled/),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pay now' }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(shopSent.payHereCheckouts).toEqual(['SD-001040'])
  })

  it('waits for PayHere to confirm the payment after the customer returns', async () => {
    logInMockCustomer()
    enableCardPayments()
    seedAdminOrder({ orderNumber: 'SD-001041', paymentMethod: 'CARD' })
    renderRoute('/account/orders/SD-001041?payment=return')

    expect(
      await screen.findByText('Confirming your payment with PayHere…'),
    ).toBeInTheDocument()
    // PayHere's verified notification reaches the server meanwhile
    updateMockOrder('SD-001041', { paymentStatus: 'PAID' })

    expect(
      await screen.findByText(
        'Payment received. Thank you!',
        {},
        { timeout: 6000 },
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pay now' }),
    ).not.toBeInTheDocument()
  }, 10000)

  it('shows the payment attempts to the owner', async () => {
    logInMockAdmin()
    seedAdminOrder({
      orderNumber: 'SD-001042',
      paymentMethod: 'CARD',
      paymentStatus: 'PAID',
      payments: [
        {
          id: 'pay-1',
          provider: 'PAYHERE',
          status: 'SUCCEEDED',
          amount: '1741.00',
          currency: 'LKR',
          providerPaymentId: '320025071278',
          method: 'VISA',
          message: 'Successfully completed',
          createdAt: '2026-11-15T08:00:00Z',
          updatedAt: '2026-11-15T08:01:00Z',
        },
      ],
    })
    renderRoute('/admin/orders/SD-001042')

    const attempts = await screen.findByRole('list', {
      name: 'Online payment attempts',
    })
    expect(attempts).toHaveTextContent(
      /succeeded · LKR 1741\.00 · VISA · PayHere 320025071278/,
    )
  })

  it('never posts the form anywhere but PayHere', () => {
    expect(() =>
      submitToPayHere({ actionUrl: 'https://evil.example/pay', fields: {} }),
    ).toThrow('Unexpected payment address.')
  })
})
