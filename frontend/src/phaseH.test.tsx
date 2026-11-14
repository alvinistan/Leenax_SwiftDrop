import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { logInMockAdmin } from './test/mockAdminApi'
import { sent } from './test/mockShippingApi'
import { renderRoute } from './test/renderRoute'

describe('shipping reports', () => {
  it('shows the headline numbers and every chart with its numbers', async () => {
    logInMockAdmin()
    renderRoute(
      '/admin/shipping/reports?from=2026-11-01&to=2026-11-14&groupBy=DAY',
    )

    const tiles = await screen.findByText('Gross shipping margin', {
      selector: 'dt',
    })
    expect(tiles.nextSibling).toHaveTextContent(/-?LKR\\s?-?28\.00|28\.00/)
    expect(
      screen.getByText('1 without a courier charge yet'),
    ).toBeInTheDocument()
    expect(screen.getByText('1.5 days')).toBeInTheDocument()

    // Each chart is a figure with a caption, a text summary and a table of the same numbers
    const chart = screen.getByRole('figure', {
      name: 'Delivery charged vs courier costs',
    })
    expect(within(chart).getByRole('img')).toHaveAccessibleName(/2 periods/)
    await userEvent.click(within(chart).getByText('Show the numbers'))
    const row = within(chart).getByRole('row', { name: /14 Nov/ })
    expect(row).toHaveTextContent(/650\.00/)

    const margin = screen.getByRole('figure', { name: 'Gross shipping margin' })
    expect(within(margin).getByText(/Not net profit/)).toBeInTheDocument()
    expect(
      screen.getByRole('figure', { name: 'Shipments by destination' }),
    ).toHaveTextContent('Sri Lanka')
    expect(
      screen.getByRole('figure', { name: 'Shipments by status' }),
    ).toHaveTextContent('In transit')
    expect(sent.reports[0]).toEqual({
      kind: 'summary',
      from: '2026-11-01',
      to: '2026-11-14',
      groupBy: 'DAY',
    })
  })

  it('changes the period and grouping through the filters', async () => {
    logInMockAdmin()
    const router = renderRoute(
      '/admin/shipping/reports?from=2026-11-01&to=2026-11-14',
    )

    await screen.findByRole('figure', { name: 'Gross shipping margin' })
    await userEvent.selectOptions(screen.getByLabelText('Group by'), 'MONTH')
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))

    await waitFor(() =>
      expect(router.state.location.search).toContain('groupBy=MONTH'),
    )
    await waitFor(() =>
      expect(sent.reports.at(-1)).toMatchObject({ groupBy: 'MONTH' }),
    )
  })

  it('shows this month on the shipping overview', async () => {
    logInMockAdmin()
    renderRoute('/admin/shipping')

    const month = await screen.findByRole('region', {
      name: 'This month so far',
    })
    expect(
      await within(month).findByText('Average delivery time'),
    ).toBeInTheDocument()
    expect(
      within(month).getByRole('link', { name: 'Open reports' }),
    ).toHaveAttribute('href', '/admin/shipping/reports')
  })
})
