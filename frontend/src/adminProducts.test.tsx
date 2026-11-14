import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newVariant } from './features/admin/productSchema'
import * as mock from './test/mockAdminApi'
import { renderRoute } from './test/renderRoute'

// Options are chosen by value ('cat-1'): user-event compares option text as HTML,
// where "&" is "&amp;", so "Cakes & Bakery" would not match.
function setUp() {
  mock.logInMockAdmin()
  mock.seedCategory({ name: 'Cakes & Bakery', slug: 'cakes-bakery' })
}

const cake = () => ({
  categoryId: 'cat-1',
  name: 'Chocolate Cake',
  slug: 'chocolate-cake',
  description: null,
  shippingCategory: 'GENERAL' as const,
  hsCode: null,
  countryOfOrigin: 'LK',
  customsDescription: null,
  status: 'ACTIVE' as const,
  variants: [
    {
      ...newVariant(),
      id: 'v-piece',
      sku: 'CAKE-1PC',
      price: '1200.00',
      stockQuantity: '10',
      maxQuantity: null,
      options: { Size: '1 piece' },
    },
    {
      ...newVariant('KG'),
      id: 'v-kg',
      sku: 'CAKE-KG',
      price: '4200.00',
      stockQuantity: '3.5',
      maxQuantity: '5',
      options: { Size: 'Custom weight' },
    },
  ],
})

describe('admin products', () => {
  it('creates a product with a piece variant and a by-weight variant', async () => {
    setUp()
    const router = renderRoute('/admin/products/new')

    await userEvent.type(await screen.findByLabelText('Name'), 'Chocolate Cake')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'cat-1')
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ACTIVE')

    const first = screen.getByRole('group', { name: 'Variant 1' })
    await userEvent.type(within(first).getByLabelText('SKU'), 'CAKE-1PC')
    await userEvent.type(
      within(first).getByLabelText('Price per piece (LKR)'),
      '1200',
    )
    await userEvent.clear(within(first).getByLabelText('Stock (pieces)'))
    await userEvent.type(within(first).getByLabelText('Stock (pieces)'), '10')
    await userEvent.click(
      within(first).getByRole('button', { name: 'Add option' }),
    )
    await userEvent.type(within(first).getByLabelText('Option 1 name'), 'Size')
    await userEvent.type(
      within(first).getByLabelText('Option 1 value'),
      '1 piece',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Add variant' }))
    const second = screen.getByRole('group', { name: 'Variant 2' })
    await userEvent.type(within(second).getByLabelText('SKU'), 'CAKE-KG')
    // Switching to "by weight" changes the labels and the defaults
    await userEvent.selectOptions(within(second).getByLabelText('Sold'), 'KG')
    expect(within(second).getByLabelText('Minimum order (kg)')).toHaveValue(
      '0.5',
    )
    await userEvent.type(
      within(second).getByLabelText('Price per kg (LKR)'),
      '4200.50',
    )
    await userEvent.clear(within(second).getByLabelText('Stock (kg)'))
    await userEvent.type(within(second).getByLabelText('Stock (kg)'), '3.5')

    await userEvent.click(
      screen.getByRole('button', { name: 'Create product' }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/products'),
    )
    expect(
      await screen.findByRole('rowheader', { name: /Chocolate Cake/ }),
    ).toBeInTheDocument()
    // What was sent: exact decimal strings, options as name → value
    expect(mock.lastProductRequest?.variants).toMatchObject([
      {
        sku: 'CAKE-1PC',
        price: '1200',
        saleUnit: 'PIECE',
        stockQuantity: '10',
        options: { Size: '1 piece' },
      },
      {
        sku: 'CAKE-KG',
        price: '4200.50',
        saleUnit: 'KG',
        minQuantity: '0.5',
        quantityStep: '0.5',
        stockQuantity: '3.5',
      },
    ])
  })

  it('explains invalid variants and sends nothing', async () => {
    setUp()
    renderRoute('/admin/products/new')

    const variant = await screen.findByRole('group', { name: 'Variant 1' })
    await userEvent.type(within(variant).getByLabelText('SKU'), 'MUG')
    await userEvent.type(
      within(variant).getByLabelText('Price per piece (LKR)'),
      '12.345',
    )
    await userEvent.clear(within(variant).getByLabelText('Stock (pieces)'))
    await userEvent.type(
      within(variant).getByLabelText('Stock (pieces)'),
      '2.5',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Create product' }),
    )

    expect(
      within(variant).getByLabelText('Price per piece (LKR)'),
    ).toHaveAccessibleDescription('Enter a price like 1250 or 1250.50.')
    expect(
      within(variant).getByLabelText('Stock (pieces)'),
    ).toHaveAccessibleDescription('Pieces cannot be split: use a whole number.')
    expect(screen.getByLabelText('Category')).toHaveAccessibleDescription(
      'Choose a category.',
    )
    expect(mock.lastProductRequest).toBeUndefined()
  })

  it('edits stock and removes a variant in one save', async () => {
    setUp()
    const product = mock.seedProduct(cake())
    renderRoute(`/admin/products/${product.id}/edit`)

    const first = await screen.findByRole('group', { name: 'Variant 1' })
    await userEvent.clear(within(first).getByLabelText('Stock (pieces)'))
    await userEvent.type(within(first).getByLabelText('Stock (pieces)'), '25')
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Variant 2' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(mock.lastProductRequest?.variants).toHaveLength(1),
    )
    // The kept variant is sent with its id, so the server updates it instead of creating a new one
    expect(mock.lastProductRequest?.variants[0]).toMatchObject({
      id: 'v-piece',
      stockQuantity: '25',
    })
  })

  it('shows the server explanation when a SKU is taken by another product', async () => {
    setUp()
    mock.seedProduct(cake())
    renderRoute('/admin/products/new')

    await userEvent.type(await screen.findByLabelText('Name'), 'Another Cake')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'cat-1')
    const variant = screen.getByRole('group', { name: 'Variant 1' })
    await userEvent.type(within(variant).getByLabelText('SKU'), 'CAKE-KG')
    await userEvent.type(
      within(variant).getByLabelText('Price per piece (LKR)'),
      '100',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Create product' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'These SKUs are already used: CAKE-KG',
    )
  })

  it('searches and filters the list through the URL', async () => {
    setUp()
    mock.seedProduct(cake())
    mock.seedProduct({
      ...cake(),
      name: 'Butter Cake',
      slug: 'butter-cake',
      status: 'DRAFT',
      variants: [{ ...cake().variants[0], id: undefined, sku: 'BUTTER' }],
    })
    const router = renderRoute('/admin/products')

    expect(await screen.findAllByRole('rowheader')).toHaveLength(2)
    await userEvent.type(screen.getByLabelText('Search by name'), 'butter')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(router.state.location.search).toBe('?q=butter'))
    await waitFor(() =>
      expect(screen.getAllByRole('rowheader')).toHaveLength(1),
    )
    expect(
      screen.getByRole('rowheader', { name: /Butter Cake/ }),
    ).toBeInTheDocument()
  })
})

describe('admin product shipping details', () => {
  it('saves shipping category, customs data and packed weight and size', async () => {
    setUp()
    renderRoute('/admin/products/new')

    await userEvent.type(await screen.findByLabelText('Name'), 'Dried Fish')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'cat-1')
    const shipping = screen.getByRole('region', {
      name: 'Shipping and customs',
    })
    await userEvent.selectOptions(
      within(shipping).getByLabelText('Shipping category'),
      'FOOD_SHELF_STABLE',
    )
    expect(
      within(shipping).getByLabelText('Shipping category'),
    ).toHaveAccessibleDescription(
      expect.stringContaining('confirm before shipping'),
    )
    await userEvent.type(
      within(shipping).getByLabelText('HS code (optional)'),
      '0305.59',
    )
    await userEvent.type(
      within(shipping).getByLabelText('Customs description (optional)'),
      'Dried fish, vacuum packed',
    )

    const variant = screen.getByRole('group', { name: 'Variant 1' })
    await userEvent.type(within(variant).getByLabelText('SKU'), 'FISH-KG')
    await userEvent.selectOptions(within(variant).getByLabelText('Sold'), 'KG')
    await userEvent.type(
      within(variant).getByLabelText('Price per kg (LKR)'),
      '3500',
    )
    // The label explains what the weight means for kg selling
    await userEvent.type(
      within(variant).getByLabelText('Shipping weight per kg sold (kg)'),
      '1.05',
    )
    await userEvent.type(
      within(variant).getByLabelText('Packed length (cm)'),
      '25',
    )
    await userEvent.type(
      within(variant).getByLabelText('Packed width (cm)'),
      '18',
    )
    await userEvent.type(
      within(variant).getByLabelText('Packed height (cm)'),
      '4.5',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Create product' }),
    )

    await waitFor(() => expect(mock.lastProductRequest).toBeDefined())
    expect(mock.lastProductRequest).toMatchObject({
      shippingCategory: 'FOOD_SHELF_STABLE',
      hsCode: '0305.59',
      countryOfOrigin: 'LK',
      customsDescription: 'Dried fish, vacuum packed',
      variants: [
        {
          shippingWeightKg: '1.05',
          lengthCm: '25',
          widthCm: '18',
          heightCm: '4.5',
        },
      ],
    })
  })

  it('asks for all three sides and a valid HS code', async () => {
    setUp()
    renderRoute('/admin/products/new')

    const variant = await screen.findByRole('group', { name: 'Variant 1' })
    await userEvent.type(
      within(variant).getByLabelText('Packed length (cm)'),
      '25',
    )
    await userEvent.type(screen.getByLabelText('HS code (optional)'), '12AB')
    await userEvent.click(
      screen.getByRole('button', { name: 'Create product' }),
    )

    expect(
      within(variant).getByLabelText('Packed width (cm)'),
    ).toHaveAccessibleDescription(
      'Enter length, width and height together, or leave all three empty.',
    )
    expect(
      screen.getByLabelText('HS code (optional)'),
    ).toHaveAccessibleDescription(
      expect.stringContaining('Enter an HS code like 0305.59'),
    )
    expect(mock.lastProductRequest).toBeUndefined()
  })

  it('flags products without a shipping weight in the list', async () => {
    setUp()
    mock.seedProduct({ ...cake(), name: 'No Weight Cake', slug: 'no-weight' })
    mock.seedProduct({
      ...cake(),
      name: 'Weighed Cake',
      slug: 'weighed',
      variants: cake().variants.map((v, i) => ({
        ...v,
        id: `w-${i}`,
        sku: `W-${i}`,
        shippingWeightKg: '1.3',
      })),
    })
    renderRoute('/admin/products')

    const noWeight = await screen.findByRole('row', { name: /No Weight Cake/ })
    expect(within(noWeight).getByText('Weight missing')).toBeInTheDocument()
    const weighed = screen.getByRole('row', { name: /Weighed Cake/ })
    expect(
      within(weighed).queryByText('Weight missing'),
    ).not.toBeInTheDocument()
  })
})
