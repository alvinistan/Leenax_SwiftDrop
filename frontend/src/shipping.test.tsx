import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { logInMockAdmin, seedCategory, seedProduct } from './test/mockAdminApi'
import {
  DEX_SERVICE_ID,
  seedAudit,
  sent,
  setSimulatedQuote,
} from './test/mockShippingApi'
import { renderRoute } from './test/renderRoute'

/** The card (region) for one shipping category on the restrictions page. */
async function categoryCard(name: RegExp) {
  return screen.findByRole('region', { name })
}

describe('shipping administration', () => {
  it('has a Shipping menu with a set-up checklist', async () => {
    logInMockAdmin()
    renderRoute('/admin')

    await userEvent.click(await screen.findByRole('link', { name: 'Shipping' }))

    expect(
      await screen.findByRole('heading', { name: 'Shipping', level: 1 }),
    ).toBeInTheDocument()
    const shippingNav = screen.getByRole('navigation', { name: 'Shipping' })
    expect(
      within(shippingNav).getByRole('link', { name: 'Country restrictions' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('DEX price list for Sri Lanka', {
        selector: 'p',
      }),
    ).toHaveTextContent('DEX price list for Sri Lanka (to do)')
    expect(screen.getByText(/Sillalai South, Jaffna/)).toBeInTheDocument()
    expect(screen.getByText(/paid by the receiver/)).toBeInTheDocument()
  })
})

describe('country restrictions', () => {
  it('blocks one country for one category and saves it', async () => {
    logInMockAdmin()
    renderRoute('/admin/shipping/restrictions')

    const card = await categoryCard(/Shelf-stable food/)
    const save = within(card).getByRole('button', { name: /Save changes/ })
    expect(save).toBeDisabled() // nothing changed yet

    await userEvent.type(
      within(card).getByLabelText(/Find a country to block/),
      'austr',
    )
    const results = within(card).getByRole('list', {
      name: 'Matching countries',
    })
    // "austr" matches Australia and Austria
    expect(within(results).getAllByRole('button')).toHaveLength(2)
    await userEvent.click(
      within(results).getByRole('button', { name: /Block Australia/ }),
    )

    expect(
      within(card).getByRole('button', { name: 'Unblock Australia' }),
    ).toBeInTheDocument()
    expect(within(card).getByText('Blocked countries (1)')).toBeInTheDocument()

    await userEvent.click(save)

    expect(await within(card).findByRole('status')).toHaveTextContent(
      'Saved restrictions',
    )
    expect(sent.policies).toEqual([
      {
        category: 'FOOD_SHELF_STABLE',
        body: { internationalAllowed: true, blockedCountries: ['AU'] },
      },
    ])
    // Other categories were not touched
    expect(
      within(await categoryCard(/General goods/)).getByText(
        'Blocked countries (0)',
      ),
    ).toBeInTheDocument()
  })

  it('can make a category Sri Lanka only', async () => {
    logInMockAdmin()
    renderRoute('/admin/shipping/restrictions')

    const card = await categoryCard(/Fragile items/)
    await userEvent.click(
      within(card).getByRole('checkbox', {
        name: 'Allow international shipping',
      }),
    )
    expect(within(card).getByText('Sri Lanka only')).toBeInTheDocument()
    expect(
      within(card).queryByLabelText(/Find a country to block/),
    ).not.toBeInTheDocument()

    await userEvent.click(
      within(card).getByRole('button', { name: /Save changes/ }),
    )

    await waitFor(() =>
      expect(sent.policies[0]).toEqual({
        category: 'FRAGILE',
        body: { internationalAllowed: false, blockedCountries: [] },
      }),
    )
  })

  it('never offers Sri Lanka itself, and undo restores the saved list', async () => {
    logInMockAdmin()
    renderRoute('/admin/shipping/restrictions')

    const card = await categoryCard(/General goods/)
    const search = within(card).getByLabelText(/Find a country to block/)
    await userEvent.type(search, 'sri')
    expect(within(card).getByText(/No matching country/)).toBeInTheDocument()

    await userEvent.clear(search)
    await userEvent.type(search, 'canada')
    await userEvent.click(
      within(card).getByRole('button', { name: /Block Canada/ }),
    )
    await userEvent.click(
      within(card).getByRole('button', { name: 'Undo changes' }),
    )

    expect(within(card).getByText('Blocked countries (0)')).toBeInTheDocument()
    expect(sent.policies).toHaveLength(0)
  })
})

describe('rate cards', () => {
  it('checks that weight bands go up, then saves exact values', async () => {
    logInMockAdmin()
    const router = renderRoute('/admin/shipping/rate-cards/new')

    await userEvent.selectOptions(
      await screen.findByLabelText('Courier service'),
      DEX_SERVICE_ID,
    )
    await userEvent.type(screen.getByLabelText('Band 1: up to (kg)'), '2')
    await userEvent.type(screen.getByLabelText('Band 1: price (LKR)'), '550')
    await userEvent.click(screen.getByRole('button', { name: /Add band/ }))
    await userEvent.type(screen.getByLabelText('Band 2: up to (kg)'), '1')
    await userEvent.type(screen.getByLabelText('Band 2: price (LKR)'), '400')
    await userEvent.click(
      screen.getByRole('button', { name: 'Save rate card' }),
    )

    expect(
      screen.getByLabelText('Band 2: up to (kg)'),
    ).toHaveAccessibleDescription('Must be more than the band above.')
    expect(sent.rateCards).toHaveLength(0)

    await userEvent.clear(screen.getByLabelText('Band 2: up to (kg)'))
    await userEvent.type(screen.getByLabelText('Band 2: up to (kg)'), '5')
    await userEvent.clear(screen.getByLabelText('Band 2: price (LKR)'))
    await userEvent.type(screen.getByLabelText('Band 2: price (LKR)'), '900.50')
    await userEvent.click(
      screen.getByRole('button', { name: 'Save rate card' }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/shipping/rate-cards'),
    )
    expect(sent.rateCards[0]).toEqual({
      serviceId: DEX_SERVICE_ID,
      countryCode: 'LK',
      enabled: true,
      bands: [
        { maxWeightKg: '2', price: '550' },
        { maxWeightKg: '5', price: '900.50' },
      ],
    })
    expect(
      await screen.findByRole('rowheader', {
        name: 'DEX · DEX standard delivery (Sri Lanka)',
      }),
    ).toBeInTheDocument()
  })
})

describe('platform fee', () => {
  it('lists the default 2 % rule', async () => {
    logInMockAdmin()
    renderRoute('/admin/shipping/markup')

    const row = (
      await screen.findByRole('rowheader', { name: 'Default platform fee' })
    ).closest('tr')!
    expect(within(row).getByText('2%')).toBeInTheDocument()
    expect(within(row).getByText('Active')).toBeInTheDocument()
    expect(screen.getByText(/This is a fee, not profit/)).toBeInTheDocument()
  })

  it('asks for the values the fee type needs and sends only those', async () => {
    logInMockAdmin()
    const router = renderRoute('/admin/shipping/markup/new')

    await userEvent.type(await screen.findByLabelText('Name'), 'UK fee')
    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }))
    expect(screen.getByLabelText('Percent (%)')).toHaveAccessibleDescription(
      'Enter the percent.',
    )

    await userEvent.selectOptions(screen.getByLabelText('Fee type'), 'FIXED')
    expect(screen.queryByLabelText('Percent (%)')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Fixed amount (LKR)'), '250')
    await userEvent.selectOptions(
      screen.getByLabelText('Destination country'),
      'GB',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/shipping/markup'),
    )
    expect(sent.markupRules[0]).toMatchObject({
      name: 'UK fee',
      type: 'FIXED',
      percent: null,
      fixedAmount: '250',
      countryCode: 'GB',
      providerId: null,
      effectiveFrom: null,
      priority: 0,
    })
  })
})

describe('pickup settings', () => {
  it('shows the pickup address and saves changes', async () => {
    logInMockAdmin()
    renderRoute('/admin/shipping/settings')

    const city = await screen.findByLabelText('City')
    expect(city).toHaveValue('Jaffna')
    expect(screen.getByLabelText('Address line 1')).toHaveValue(
      'Sillalai South',
    )
    expect(screen.getByLabelText('Import duties and taxes abroad')).toHaveValue(
      'RECEIVER',
    )

    await userEvent.clear(
      screen.getByLabelText('Default packaging weight (kg)'),
    )
    await userEvent.type(
      screen.getByLabelText('Default packaging weight (kg)'),
      '0.3',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))

    expect(
      await screen.findByText('Pickup settings saved.'),
    ).toBeInTheDocument()
    expect(sent.settings[0]).toMatchObject({
      originCity: 'Jaffna',
      originPostalCode: '40000',
      defaultPackagingKg: '0.3',
      dutiesPaidBy: 'RECEIVER',
    })
  })

  it('adds a box size', async () => {
    logInMockAdmin()
    renderRoute('/admin/shipping/settings')

    await userEvent.click(
      await screen.findByRole('button', { name: /Add box/ }),
    )
    await userEvent.type(screen.getByLabelText('Name'), 'Cake box')
    await userEvent.type(screen.getByLabelText('Length (cm)'), '25')
    await userEvent.type(screen.getByLabelText('Width (cm)'), '25')
    await userEvent.type(screen.getByLabelText('Height (cm)'), '12')
    await userEvent.type(screen.getByLabelText('Empty box weight (kg)'), '0.3')
    await userEvent.click(screen.getByRole('button', { name: 'Add box' }))

    expect(
      await screen.findByRole('rowheader', { name: 'Cake box' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Box "Cake box" added.')).toBeInTheDocument()
  })
})

describe('quote simulator', () => {
  it('shows the courier price, fee and customer price', async () => {
    logInMockAdmin()
    seedCategory({ name: 'Cakes', slug: 'cakes' })
    const product = seedProduct({
      categoryId: 'cat-1',
      name: 'Rich cake',
      slug: 'rich-cake',
      description: null,
      status: 'ACTIVE',
      shippingCategory: 'FOOD_SHELF_STABLE',
      hsCode: null,
      countryOfOrigin: 'LK',
      customsDescription: null,
      variants: [
        {
          sku: 'RC-1',
          price: '2500',
          saleUnit: 'PIECE',
          minQuantity: '1',
          maxQuantity: null,
          quantityStep: '1',
          stockQuantity: '5',
          options: { Size: '1 kg' },
          active: true,
          shippingWeightKg: '1.2',
          lengthCm: '10',
          widthCm: '10',
          heightCm: '10',
        },
      ],
    })
    setSimulatedQuote({
      destinationCountry: 'LK',
      domestic: true,
      dutiesPaidBy: 'RECEIVER',
      items: [],
      parcel: {
        itemsWeightKg: '1.2',
        packagingKg: '0.2',
        actualWeightKg: '1.4',
        boxName: 'Small (example)',
        lengthCm: '20',
        widthCm: '15',
        heightCm: '10',
        fits: true,
      },
      problems: [],
      warnings: [],
      options: [
        {
          serviceId: DEX_SERVICE_ID,
          providerCode: 'DEX',
          providerName: 'DEX',
          serviceName: 'DEX standard delivery (Sri Lanka)',
          scope: 'DOMESTIC',
          available: true,
          unavailableReason: null,
          volumetricWeightKg: null,
          chargeableWeightKg: '2',
          courierPrice: { amount: '550.00', currency: 'LKR' },
          platformFee: { amount: '11.00', currency: 'LKR' },
          customerPrice: { amount: '561.00', currency: 'LKR' },
          markupRuleId: 'rule-default',
          markupDescription: '2% (Default platform fee)',
        },
      ],
    })
    renderRoute('/admin/shipping/simulator')

    await userEvent.type(await screen.findByLabelText('Find a product'), 'rich')
    await userEvent.click(screen.getByRole('button', { name: /Search/ }))
    await userEvent.click(
      await screen.findByRole('button', { name: 'Choose Rich cake' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: /Add 1 kg/ }),
    )
    expect(screen.getByLabelText('Quantity')).toHaveValue('1')
    await userEvent.click(
      screen.getByRole('button', { name: /Work out the price/ }),
    )

    const table = await screen.findByRole('table', { name: 'Courier options' })
    const row = within(table).getByRole('row', { name: /DEX standard/ })
    expect(within(row).getByText(/550\.00/)).toBeInTheDocument()
    expect(within(row).getByText(/11\.00/)).toBeInTheDocument()
    expect(within(row).getByText(/561\.00/)).toBeInTheDocument()
    expect(screen.getByText('1.4 kg')).toBeInTheDocument()
    expect(sent.quotes[0]).toEqual({
      countryCode: 'LK',
      items: [{ variantId: product.variants[0].id, quantity: '1' }],
    })
  })
})

describe('change history', () => {
  it('lists changes with before and after', async () => {
    logInMockAdmin()
    seedAudit([
      {
        id: 'a1',
        entityType: 'COUNTRY_RESTRICTIONS',
        entityId: 'FOOD_SHELF_STABLE',
        action: 'UPDATE',
        actor: 'owner@example.com',
        beforeJson: '{"blockedCountries":[]}',
        afterJson: '{"blockedCountries":["AU"]}',
        createdAt: '2026-11-14T10:30:00Z',
      },
    ])
    renderRoute('/admin/shipping/history')

    const entry = (await screen.findByText(/by owner@example.com/)).closest(
      'li',
    )!
    expect(within(entry).getByText('Country restrictions')).toBeInTheDocument()
    expect(within(entry).getByText('update')).toBeInTheDocument()
    await userEvent.click(within(entry).getByText('Show before and after'))
    expect(within(entry).getByText(/"AU"/)).toBeVisible()
  })
})
