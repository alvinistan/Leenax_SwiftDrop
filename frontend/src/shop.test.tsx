import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  logInMockAdmin,
  logInMockCustomer,
  seedCategory,
  seedProduct,
  lastProductRequest,
} from './test/mockAdminApi'
import {
  failNextOrder,
  seedAdminOrder,
  seedShopVariant,
  seedTaxRates,
  shopSent,
} from './test/mockShopApi'
import { sent } from './test/mockShippingApi'
import { renderRoute } from './test/renderRoute'

function putInCart(items: { variantId: string; quantity: string }[]) {
  localStorage.setItem('swiftdrop-cart-v1', JSON.stringify(items))
}

describe('cart', () => {
  it('shows server prices with the tax included and checks stock', async () => {
    seedShopVariant({ variantId: 'v-toffee' })
    seedShopVariant({
      variantId: 'v-fish',
      productName: 'Dried fish',
      stock: 1,
      taxPercent: 0,
    })
    putInCart([
      { variantId: 'v-toffee', quantity: '2' },
      { variantId: 'v-fish', quantity: '3' },
    ])
    renderRoute('/cart')

    const list = await screen.findByRole('list', { name: 'Items in your cart' })
    expect(
      within(list).getByRole('link', { name: 'Milk toffee' }),
    ).toBeInTheDocument()
    expect(within(list).getByText(/2,360\.00/)).toBeInTheDocument()
    expect(
      within(list).getByText('Only a smaller quantity is in stock.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the items')
    expect(
      screen.queryByRole('link', { name: 'Go to checkout' }),
    ).not.toBeInTheDocument()

    await userEvent.click(
      within(list).getByRole('button', { name: /Remove Dried fish/ }),
    )

    expect(
      await screen.findByRole('link', { name: 'Go to checkout' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Includes tax').nextSibling).toHaveTextContent(
      /360\.00/,
    )
    expect(
      screen.getByRole('link', { name: 'Cart, 1 item' }),
    ).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('swiftdrop-cart-v1')!)).toEqual([
      { variantId: 'v-toffee', quantity: '2' },
    ])
  })

  it('is kept in this browser when an item is added', async () => {
    renderRoute('/products/ceramic-coffee-mug')
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add to cart' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))

    const saved = JSON.parse(localStorage.getItem('swiftdrop-cart-v1')!)
    expect(saved).toHaveLength(1)
    expect(saved[0].quantity).toBe('2') // the same item adds up
    expect(screen.getByRole('link', { name: 'View cart' })).toHaveAttribute(
      'href',
      '/cart',
    )
  })
})

describe('accounts', () => {
  it('sends visitors to log in or sign up before checkout, then back', async () => {
    seedShopVariant({ variantId: 'v-toffee' })
    putInCart([{ variantId: 'v-toffee', quantity: '1' }])
    const router = renderRoute('/checkout')

    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('link', { name: 'Create an account' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Create an account' }),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Your name'), 'Nimal')
    await userEvent.type(
      screen.getByLabelText('Email address'),
      'nimal@example.com',
    )
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.type(screen.getByLabelText('Repeat password'), 'different')
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' }),
    )
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      /Use at least 12 characters/,
    )
    expect(
      screen.getByLabelText('Repeat password'),
    ).toHaveAccessibleDescription('The passwords do not match.')

    await userEvent.clear(screen.getByLabelText('Password'))
    await userEvent.type(
      screen.getByLabelText('Password'),
      'a-long-enough-password',
    )
    await userEvent.clear(screen.getByLabelText('Repeat password'))
    await userEvent.type(
      screen.getByLabelText('Repeat password'),
      'a-long-enough-password',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Checkout' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/checkout')
    expect(screen.getByRole('link', { name: /My orders/ })).toBeInTheDocument()
  })

  it('explains when the email already has an account', async () => {
    renderRoute('/register')
    await userEvent.type(await screen.findByLabelText('Your name'), 'Kamala')
    await userEvent.type(
      screen.getByLabelText('Email address'),
      'owner@example.com',
    )
    await userEvent.type(
      screen.getByLabelText('Password'),
      'a-long-enough-password',
    )
    await userEvent.type(
      screen.getByLabelText('Repeat password'),
      'a-long-enough-password',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' }),
    )

    await waitFor(() =>
      expect(
        screen.getByLabelText('Email address'),
      ).toHaveAccessibleDescription(
        'An account with this email already exists. Log in instead.',
      ),
    )
  })
})

async function fillAddress(country = 'LK') {
  await userEvent.type(await screen.findByLabelText('Recipient name'), 'Kamala')
  await userEvent.type(screen.getByLabelText('Phone number'), '+94 77 123 4567')
  await userEvent.type(screen.getByLabelText('Address'), '12 Temple Road')
  await userEvent.type(screen.getByLabelText('City / town'), 'Jaffna')
  await userEvent.selectOptions(screen.getByLabelText('Country'), country)
  await userEvent.click(
    screen.getByRole('button', { name: /Show delivery options/ }),
  )
}

describe('checkout', () => {
  it('places a cash-on-delivery order without sending any price', async () => {
    logInMockCustomer()
    seedShopVariant({ variantId: 'v-toffee', codAllowed: true })
    putInCart([{ variantId: 'v-toffee', quantity: '1' }])
    const router = renderRoute('/checkout')

    await fillAddress('LK')
    await userEvent.click(
      await screen.findByRole('radio', { name: /DEX · Standard/ }),
    )
    await userEvent.click(
      screen.getByRole('radio', { name: 'Cash on delivery' }),
    )
    const summary = screen.getByRole('complementary', { name: 'Order summary' })
    expect(within(summary).getByText(/1,741\.00/)).toBeInTheDocument() // 1,180 + 561
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))

    expect(
      await screen.findByText(
        /Thank you! Your order SD-001001 has been placed/,
      ),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/account/orders/SD-001001')
    expect(
      screen.getByRole('link', { name: 'Cart, 0 items' }),
    ).toBeInTheDocument()

    const { body, key } = shopSent.orders[0]
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    expect(body).toEqual({
      items: [{ variantId: 'v-toffee', quantity: '1' }],
      address: {
        recipientName: 'Kamala',
        phone: '+94 77 123 4567',
        line1: '12 Temple Road',
        line2: null,
        city: 'Jaffna',
        region: null,
        postalCode: null,
        countryCode: 'LK',
      },
      quoteOptionId: 'opt-dex',
      paymentMethod: 'COD',
      note: null,
    })
  })

  it('offers cash on delivery only in Sri Lanka and only if every product allows it', async () => {
    logInMockCustomer()
    seedShopVariant({ variantId: 'v-toffee', codAllowed: true })
    seedShopVariant({
      variantId: 'v-fish',
      productName: 'Dried fish',
      codAllowed: false,
    })
    putInCart([
      { variantId: 'v-toffee', quantity: '1' },
      { variantId: 'v-fish', quantity: '1' },
    ])
    renderRoute('/checkout')

    await fillAddress('LK')
    await userEvent.click(await screen.findByRole('radio', { name: /DEX/ }))
    expect(
      screen.queryByRole('radio', { name: 'Cash on delivery' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Cash on delivery is not available for this order.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('radio', {
        name: 'We will contact you to arrange payment',
      }),
    ).toBeChecked()
  })

  it('tells customers abroad that the receiver pays import duties', async () => {
    logInMockCustomer()
    seedShopVariant({ variantId: 'v-toffee', codAllowed: true })
    putInCart([{ variantId: 'v-toffee', quantity: '1' }])
    renderRoute('/checkout')

    await fillAddress('CA')
    expect(
      await screen.findByText(
        'Import duties and taxes in the destination country are paid by the receiver.',
      ),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /DHL Express/ }))
    expect(
      screen.queryByRole('radio', { name: 'Cash on delivery' }),
    ).not.toBeInTheDocument()
  })

  it('asks again when the delivery price changed, keeping the same order key', async () => {
    logInMockCustomer()
    seedShopVariant({ variantId: 'v-toffee' })
    putInCart([{ variantId: 'v-toffee', quantity: '1' }])
    failNextOrder(
      'The delivery price has changed to 600.00 LKR. Please review it and place the order again.',
    )
    renderRoute('/checkout')

    await fillAddress('LK')
    await userEvent.click(await screen.findByRole('radio', { name: /DEX/ }))
    await userEvent.click(
      screen.getByRole('radio', { name: 'Cash on delivery' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The delivery price has changed',
    )
    // Delivery options must be fetched again
    expect(screen.queryByRole('radio', { name: /DEX/ })).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: /Show delivery options/ }),
    )
    await userEvent.click(await screen.findByRole('radio', { name: /DEX/ }))
    await userEvent.click(
      screen.getByRole('radio', { name: 'Cash on delivery' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await screen.findByText(/has been placed/)
    expect(shopSent.orders).toHaveLength(2)
    expect(shopSent.orders[1].key).toBe(shopSent.orders[0].key)
  })

  it('needs a valid address before showing delivery options', async () => {
    logInMockCustomer()
    seedShopVariant({ variantId: 'v-toffee' })
    putInCart([{ variantId: 'v-toffee', quantity: '1' }])
    renderRoute('/checkout')

    await userEvent.click(
      await screen.findByRole('button', { name: /Show delivery options/ }),
    )
    expect(screen.getByLabelText('Phone number')).toHaveAccessibleDescription(
      'Enter a phone number like +94 77 123 4567.',
    )
    expect(shopSent.quotes).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled()
  })

  it('does not let an admin account place orders', async () => {
    logInMockAdmin()
    renderRoute('/checkout')
    expect(
      await screen.findByRole('heading', { name: 'Customer account needed' }),
    ).toBeInTheDocument()
  })
})

describe('my orders', () => {
  it('lists orders and cancels one that is not confirmed yet', async () => {
    logInMockCustomer()
    seedAdminOrder({ orderNumber: 'SD-001005' })
    renderRoute('/account/orders')

    await userEvent.click(
      await screen.findByRole('link', { name: 'Order SD-001005' }),
    )
    expect(
      await screen.findByRole('heading', { name: /Order SD-001005/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('We will contact you to arrange payment'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel order' }),
    )

    expect(await screen.findAllByText('Cancelled')).not.toHaveLength(0)
    expect(
      screen.queryByRole('button', { name: 'Cancel order' }),
    ).not.toBeInTheDocument()
  })
})

describe('admin orders', () => {
  it('shows the delivery breakdown and moves the order on', async () => {
    logInMockAdmin()
    seedAdminOrder({ orderNumber: 'SD-001007' })
    renderRoute('/admin/orders')

    await userEvent.click(
      await screen.findByRole('link', { name: 'SD-001007' }),
    )
    expect(
      await screen.findByText(/2% \(Default platform fee\)/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Courier price/).nextSibling).toHaveTextContent(
      /550\.00/,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Mark as paid' }))
    expect(await screen.findByText('Paid')).toBeInTheDocument()
    await userEvent.type(
      screen.getByLabelText('Note (optional)'),
      'Called the customer',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Confirm order' }))

    expect(
      await screen.findByRole('button', { name: 'Mark as shipped' }),
    ).toBeInTheDocument()
    expect(shopSent.statusChanges[0]).toEqual({
      status: 'CONFIRMED',
      note: 'Called the customer',
    })
  })
})

describe('tax and COD settings', () => {
  it('creates a tax rate', async () => {
    logInMockAdmin()
    renderRoute('/admin/tax-rates')

    await userEvent.click(
      await screen.findByRole('button', { name: /New tax rate/ }),
    )
    await userEvent.type(screen.getByLabelText('Name'), 'VAT 18%')
    await userEvent.type(screen.getByLabelText('Percent (%)'), '180')
    await userEvent.click(screen.getByRole('button', { name: 'Save tax rate' }))
    expect(screen.getByLabelText('Percent (%)')).toHaveAccessibleDescription(
      'At most 100.',
    )

    await userEvent.clear(screen.getByLabelText('Percent (%)'))
    await userEvent.type(screen.getByLabelText('Percent (%)'), '18')
    await userEvent.click(screen.getByRole('button', { name: 'Save tax rate' }))
    expect(
      await screen.findByRole('rowheader', { name: 'VAT 18%' }),
    ).toBeInTheDocument()
  })

  it('sets the tax rate and cash on delivery per product', async () => {
    logInMockAdmin()
    seedTaxRates([
      { id: 'tax-1', name: 'VAT 18%', percent: '18', productCount: 0 },
    ])
    seedCategory({ name: 'Sweets', slug: 'sweets' })
    const product = seedProduct({
      categoryId: 'cat-1',
      name: 'Milk toffee',
      slug: 'milk-toffee',
      description: null,
      status: 'ACTIVE',
      shippingCategory: 'FOOD_SHELF_STABLE',
      hsCode: null,
      countryOfOrigin: 'LK',
      customsDescription: null,
      variants: [
        {
          sku: 'MT-1',
          price: '1180',
          saleUnit: 'PIECE',
          minQuantity: '1',
          maxQuantity: null,
          quantityStep: '1',
          stockQuantity: '5',
          options: {},
          active: true,
          shippingWeightKg: '0.3',
          lengthCm: null,
          widthCm: null,
          heightCm: null,
        },
      ],
    })
    renderRoute(`/admin/products/${product.id}/edit`)

    // The tax rates load after the form: wait for the option first.
    await screen.findByRole('option', { name: 'VAT 18% (18%)' })
    await userEvent.selectOptions(
      screen.getByLabelText('Tax included in the price'),
      'tax-1',
    )
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Cash on delivery allowed' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(lastProductRequest).toMatchObject({
        taxRateId: 'tax-1',
        codAllowed: true,
      }),
    )
  })

  it('chooses the countries we deliver to', async () => {
    logInMockAdmin()
    renderRoute('/admin/shipping/restrictions')

    const card = await screen.findByRole('region', {
      name: 'Countries we deliver to',
    })
    expect(
      await within(card).findByRole('button', { name: 'Remove Canada' }),
    ).toBeInTheDocument()
    await userEvent.type(
      within(card).getByLabelText(/Find a country to add/),
      'austral',
    )
    await userEvent.click(
      within(card).getByRole('button', { name: /Add Australia/ }),
    )
    await userEvent.click(
      within(card).getByRole('button', { name: 'Save countries' }),
    )

    await waitFor(() =>
      expect(sent.destinations[0]).toEqual(['AU', 'CA', 'GB']),
    )
  })
})
