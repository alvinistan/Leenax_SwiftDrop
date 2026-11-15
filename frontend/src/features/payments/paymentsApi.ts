import { http } from '../../api/http'

/** Is "Pay online by card" offered? (Only when PayHere is set up on the server.) */
export async function getPaymentOptions(signal?: AbortSignal) {
  return (
    await http.get<{ card: boolean }>('/api/payments/options', { signal })
  ).data
}

/** The signed form to send the customer to PayHere. Made on the server (the secret never reaches the browser). */
export type PayHereForm = { actionUrl: string; fields: Record<string, string> }

export async function startPayHereCheckout(orderNumber: string) {
  return (
    await http.post<PayHereForm>(
      `/api/orders/${encodeURIComponent(orderNumber)}/payhere-checkout`,
    )
  ).data
}

/** Only PayHere's official checkout addresses are allowed as the form target. */
const PAYHERE_URLS = [
  'https://sandbox.payhere.lk/pay/checkout',
  'https://www.payhere.lk/pay/checkout',
]

/**
 * Sends the browser to PayHere with an ordinary form POST, as PayHere's
 * Checkout API requires. (The browser sends the Referer header PayHere checks.)
 */
export function submitToPayHere(form: PayHereForm) {
  if (!PAYHERE_URLS.includes(form.actionUrl)) {
    throw new Error('Unexpected payment address.')
  }
  const element = document.createElement('form')
  element.method = 'POST'
  element.action = form.actionUrl
  for (const [name, value] of Object.entries(form.fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    element.appendChild(input)
  }
  document.body.appendChild(element)
  element.submit()
}
