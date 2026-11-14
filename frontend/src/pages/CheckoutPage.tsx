import { zodResolver } from '@hookform/resolvers/zod'
import { Truck } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { Container } from '../components/layout/Container'
import { Button } from '../components/ui/Button'
import { buttonClasses } from '../components/ui/buttonStyles'
import { ErrorState } from '../components/ui/ErrorState'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { RequireCustomer } from '../features/auth/RequireCustomer'
import { priceCart, type PricedCart } from '../features/cart/cartApi'
import { useCart } from '../features/cart/useCart'
import {
  addressSchema,
  type AddressFormValues,
} from '../features/orders/addressSchema'
import { newIdempotencyKey } from '../features/orders/idempotencyKey'
import {
  getDeliveryQuote,
  listDestinations,
  PAYMENT_METHOD_LABELS,
  placeOrder,
  type Country,
  type DeliveryQuote,
  type PaymentMethod,
} from '../features/orders/ordersApi'
import { useAsync } from '../hooks/useAsync'
import { fromScaled, toScaled } from '../lib/decimal'
import { ApiError, userMessage } from '../lib/errors'
import { formatMoney } from '../lib/money'
import type { Money } from '../types/catalog'

export function CheckoutPage() {
  return (
    <RequireCustomer>
      <Checkout />
    </RequireCustomer>
  )
}

function Checkout() {
  const cart = useCart()
  const priced = useAsync(
    (signal) => priceCart(cart.items, signal),
    `checkout-${JSON.stringify(cart.items)}`,
  )
  const destinations = useAsync(
    (signal) => listDestinations(signal),
    'checkout-destinations',
  )

  if (cart.items.length === 0) {
    return (
      <Container className="py-24 text-center">
        <title>Checkout | Leenax SwiftDrop.lk</title>
        <h1 className="text-3xl font-bold text-slate-900">
          Your cart is empty
        </h1>
        <Link to="/products" className={`${buttonClasses()} mt-8`}>
          Continue shopping
        </Link>
      </Container>
    )
  }

  const failed = [priced.state, destinations.state].find(
    (s) => s.status === 'error',
  )
  return (
    <Container className="py-10">
      <title>Checkout | Leenax SwiftDrop.lk</title>
      <h1 className="text-3xl font-bold text-slate-900">Checkout</h1>
      {failed?.status === 'error' && (
        <div className="mt-8">
          <ErrorState description={userMessage(failed.error)} />
        </div>
      )}
      {!failed &&
        (priced.state.status === 'loading' ||
          destinations.state.status === 'loading') && (
          <p className="mt-8 text-slate-600">Loading…</p>
        )}
      {priced.state.status === 'success' &&
        destinations.state.status === 'success' &&
        (priced.state.data.orderable ? (
          <CheckoutForm
            cart={priced.state.data}
            countries={destinations.state.data}
          />
        ) : (
          <p
            role="alert"
            className="mt-8 rounded-lg bg-amber-50 p-4 text-amber-900"
          >
            Some items in your cart need attention.{' '}
            <Link to="/cart" className="font-semibold underline">
              Review your cart
            </Link>
          </p>
        ))}
    </Container>
  )
}

function addMoney(a: Money, b: Money): Money {
  return {
    amount: fromScaled(toScaled(a.amount, 2) + toScaled(b.amount, 2), 2),
    currency: a.currency,
  }
}

function CheckoutForm({
  cart,
  countries,
}: {
  cart: PricedCart
  countries: Country[]
}) {
  const { items, clear } = useCart()
  const navigate = useNavigate()
  // One key for this checkout: a double click or retry returns the same order.
  const [idempotencyKey] = useState(newIdempotencyKey)
  const [quote, setQuote] = useState<DeliveryQuote>()
  const [quotedFor, setQuotedFor] = useState<string>()
  const [optionId, setOptionId] = useState<string>()
  const [payment, setPayment] = useState<PaymentMethod>()
  const [message, setMessage] = useState<string>()
  const [isQuoting, setIsQuoting] = useState(false)
  const [isPlacing, setIsPlacing] = useState(false)
  const deliveryId = useId()
  const paymentId = useId()

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      recipientName: '',
      phone: '',
      line1: '',
      line2: '',
      city: '',
      region: '',
      postalCode: '',
      countryCode: countries.some((c) => c.code === 'LK')
        ? 'LK'
        : (countries[0]?.code ?? ''),
      note: '',
    },
  })

  // Delivery prices depend on the country and postal code: if they change, ask again.
  const country = useWatch({ control, name: 'countryCode' })
  const postal = useWatch({ control, name: 'postalCode' })
  const destinationKey = `${country}|${postal.trim()}`
  const currentQuote = quote && quotedFor === destinationKey ? quote : undefined
  const chosen = currentQuote?.options.find((o) => o.optionId === optionId)
  const codPossible =
    currentQuote?.domestic === true && cart.lines.every((l) => l.codAllowed)
  const methods: PaymentMethod[] = codPossible
    ? ['COD', 'ARRANGE_LATER']
    : ['ARRANGE_LATER']

  async function showDeliveryOptions(values: AddressFormValues) {
    setMessage(undefined)
    setIsQuoting(true)
    try {
      const result = await getDeliveryQuote({
        countryCode: values.countryCode,
        postalCode: values.postalCode || undefined,
        items,
      })
      setQuote(result)
      setQuotedFor(`${values.countryCode}|${values.postalCode.trim()}`)
      setOptionId(
        result.options.length === 1 ? result.options[0].optionId : undefined,
      )
      setPayment(undefined)
    } catch (error) {
      setMessage(userMessage(error))
    } finally {
      setIsQuoting(false)
    }
  }

  async function submitOrder() {
    if (!chosen) {
      setMessage('Choose a delivery option.')
      return
    }
    const method = methods.length === 1 ? methods[0] : payment
    if (!method) {
      setMessage('Choose how you will pay.')
      return
    }
    setMessage(undefined)
    setIsPlacing(true)
    const v = getValues()
    try {
      const order = await placeOrder(
        {
          items,
          address: {
            recipientName: v.recipientName,
            phone: v.phone,
            line1: v.line1,
            line2: v.line2 || null,
            city: v.city,
            region: v.region || null,
            postalCode: v.postalCode || null,
            countryCode: v.countryCode,
          },
          quoteOptionId: chosen.optionId,
          paymentMethod: method,
          note: v.note || null,
        },
        idempotencyKey,
      )
      clear()
      navigate(`/account/orders/${order.orderNumber}`, {
        state: { placed: true },
      })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Price changed, prices expired or not enough stock: show why and ask again.
        setQuote(undefined)
      }
      setMessage(userMessage(error))
      setIsPlacing(false)
    }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        <form onSubmit={handleSubmit(showDeliveryOptions)} noValidate>
          <fieldset className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
            <legend className="px-1 text-lg font-semibold text-slate-900">
              1. Delivery address
            </legend>
            <Input
              label="Recipient name"
              autoComplete="name"
              error={errors.recipientName?.message}
              {...register('recipientName')}
            />
            <Input
              label="Phone number"
              type="tel"
              autoComplete="tel"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label="Address"
              autoComplete="address-line1"
              error={errors.line1?.message}
              {...register('line1')}
            />
            <Input
              label="Address line 2 (optional)"
              autoComplete="address-line2"
              error={errors.line2?.message}
              {...register('line2')}
            />
            <Input
              label="City / town"
              autoComplete="address-level2"
              error={errors.city?.message}
              {...register('city')}
            />
            <Input
              label="District / state (optional)"
              autoComplete="address-level1"
              error={errors.region?.message}
              {...register('region')}
            />
            <Input
              label="Postal code (optional)"
              autoComplete="postal-code"
              error={errors.postalCode?.message}
              {...register('postalCode')}
            />
            <Select
              label="Country"
              autoComplete="country"
              error={errors.countryCode?.message}
              {...register('countryCode')}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary" isLoading={isQuoting}>
                <Truck className="size-4" aria-hidden="true" /> Show delivery
                options
              </Button>
            </div>
          </fieldset>
        </form>

        {currentQuote && (
          <section
            aria-labelledby={deliveryId}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2
              id={deliveryId}
              className="text-lg font-semibold text-slate-900"
            >
              2. Delivery
            </h2>
            {currentQuote.problems.length > 0 ? (
              <ul
                role="alert"
                className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-800"
              >
                {currentQuote.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              <fieldset className="mt-3">
                <legend className="sr-only">Delivery option</legend>
                <div className="space-y-2">
                  {currentQuote.options.map((o) => (
                    <label
                      key={o.optionId}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 has-checked:border-brand-700 has-checked:bg-brand-50"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="delivery"
                          value={o.optionId}
                          checked={optionId === o.optionId}
                          onChange={() => setOptionId(o.optionId)}
                          className="size-4 accent-brand-700"
                        />
                        {o.providerName} · {o.serviceName}
                      </span>
                      <span className="font-semibold">
                        {formatMoney(o.price)}
                      </span>
                    </label>
                  ))}
                </div>
                {!currentQuote.domestic && (
                  <p className="mt-3 text-sm text-slate-600">
                    {currentQuote.dutiesPaidBy === 'RECEIVER'
                      ? 'Import duties and taxes in the destination country are paid by the receiver.'
                      : 'Import duties and taxes are included.'}
                  </p>
                )}
              </fieldset>
            )}
          </section>
        )}

        {chosen && (
          <section
            aria-labelledby={paymentId}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 id={paymentId} className="text-lg font-semibold text-slate-900">
              3. Payment
            </h2>
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">Payment method</legend>
              {methods.map((m) => (
                <label
                  key={m}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 has-checked:border-brand-700 has-checked:bg-brand-50"
                >
                  <input
                    type="radio"
                    name="payment"
                    value={m}
                    checked={
                      (methods.length === 1 ? methods[0] : payment) === m
                    }
                    onChange={() => setPayment(m)}
                    className="size-4 accent-brand-700"
                  />
                  {PAYMENT_METHOD_LABELS[m]}
                </label>
              ))}
            </fieldset>
            {!codPossible && (
              <p className="mt-2 text-sm text-slate-500">
                Cash on delivery is not available for this order.
              </p>
            )}
            <div className="mt-4">
              <Textarea
                label="Note for us (optional)"
                rows={2}
                error={errors.note?.message}
                {...register('note')}
              />
            </div>
          </section>
        )}
      </div>

      <aside
        aria-labelledby="order-summary"
        className="h-fit rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 id="order-summary" className="text-lg font-semibold text-slate-900">
          Order summary
        </h2>
        <ul className="mt-4 space-y-2 text-sm">
          {cart.lines.map((l) => (
            <li key={l.variantId} className="flex justify-between gap-3">
              <span className="text-slate-700">
                {l.productName} ({l.variantLabel}) × {l.quantity}
                {l.saleUnit === 'KG' ? ' kg' : ''}
              </span>
              <span>{l.lineTotal && formatMoney(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Items</dt>
            <dd>{formatMoney(cart.itemsTotal)}</dd>
          </div>
          {Number(cart.taxIncluded.amount) > 0 && (
            <div className="flex justify-between text-slate-500">
              <dt>Includes tax</dt>
              <dd>{formatMoney(cart.taxIncluded)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-600">Delivery</dt>
            <dd>{chosen ? formatMoney(chosen.price) : '—'}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <dt>Total</dt>
            <dd>
              {chosen
                ? formatMoney(addMoney(cart.itemsTotal, chosen.price))
                : '—'}
            </dd>
          </div>
        </dl>
        {message && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800"
          >
            {message}
          </p>
        )}
        <Button
          size="lg"
          className="mt-6 w-full"
          disabled={!chosen}
          isLoading={isPlacing}
          onClick={submitOrder}
        >
          Place order
        </Button>
        {!chosen && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Enter the address and choose a delivery option first.
          </p>
        )}
      </aside>
    </div>
  )
}
