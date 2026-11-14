import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ADMIN, logInMockAdmin, seedCategory } from './test/mockAdminApi'
import { renderRoute } from './test/renderRoute'

describe('admin login', () => {
  it('sends visitors who are not logged in to the login page, then back', async () => {
    const router = renderRoute('/admin/categories')

    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe(
      '?redirectTo=%2Fadmin%2Fcategories',
    )

    await userEvent.type(screen.getByLabelText('Email address'), ADMIN.email)
    await userEvent.type(screen.getByLabelText('Password'), ADMIN.password)
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(
      await screen.findByRole('heading', { name: 'Categories' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/categories')
  })

  it('says only "incorrect" for a wrong password, without hints', async () => {
    renderRoute('/login')

    await userEvent.type(
      await screen.findByLabelText('Email address'),
      ADMIN.email,
    )
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The email or password is incorrect.',
    )
  })

  it('checks the form before sending anything', async () => {
    renderRoute('/login')

    await userEvent.click(await screen.findByRole('button', { name: 'Log in' }))

    expect(screen.getByLabelText('Email address')).toHaveAccessibleDescription(
      'Enter an email address like name@example.com.',
    )
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Enter your password.',
    )
  })

  it('never redirects to another website after login', async () => {
    const router = renderRoute('/login?redirectTo=//evil.example')

    await userEvent.type(
      await screen.findByLabelText('Email address'),
      ADMIN.email,
    )
    await userEvent.type(screen.getByLabelText('Password'), ADMIN.password)
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'))
  })

  it('shows the Admin link in the store header and logs out', async () => {
    logInMockAdmin()
    const router = renderRoute('/')

    await userEvent.click(await screen.findByRole('link', { name: 'Admin' }))
    await userEvent.click(
      await screen.findByRole('button', { name: 'Log out' }),
    )

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(
      screen.queryByRole('link', { name: 'Admin' }),
    ).not.toBeInTheDocument()
  })
})

describe('admin category management', () => {
  it('creates a category, filling in the slug from the name', async () => {
    logInMockAdmin()
    renderRoute('/admin/categories/new')

    await userEvent.type(await screen.findByLabelText('Name'), 'Cakes & Bakery')
    expect(screen.getByLabelText('Slug')).toHaveValue('cakes-bakery')

    await userEvent.click(
      screen.getByRole('button', { name: 'Create category' }),
    )

    const table = await screen.findByRole('table')
    expect(
      within(table).getByRole('rowheader', { name: 'Cakes & Bakery' }),
    ).toBeInTheDocument()
  })

  it('shows validation errors next to the fields', async () => {
    logInMockAdmin()
    renderRoute('/admin/categories/new')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Create category' }),
    )

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(
      'Name is required.',
    )
  })

  it('puts a "slug already exists" answer from the server on the slug field', async () => {
    logInMockAdmin()
    seedCategory({ name: 'Fashion', slug: 'fashion' })
    renderRoute('/admin/categories/new')

    await userEvent.type(await screen.findByLabelText('Name'), 'Fashion')
    await userEvent.click(
      screen.getByRole('button', { name: 'Create category' }),
    )

    await waitFor(() =>
      expect(screen.getByLabelText('Slug')).toHaveAccessibleDescription(
        expect.stringContaining("slug 'fashion' already exists"),
      ),
    )
  })

  it('edits an existing category', async () => {
    logInMockAdmin()
    seedCategory({ name: 'Toys', slug: 'toys' })
    renderRoute('/admin/categories')

    await userEvent.click(
      await screen.findByRole('link', { name: 'Edit Toys' }),
    )
    const name = await screen.findByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Kids & Toys')
    // editing the name does NOT change an existing slug (links would break)
    expect(screen.getByLabelText('Slug')).toHaveValue('toys')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByRole('rowheader', { name: 'Kids & Toys' }),
    ).toBeInTheDocument()
  })

  it('asks before deleting, and explains when deleting is not allowed', async () => {
    logInMockAdmin()
    seedCategory({ name: 'Old', slug: 'old' })
    seedCategory({ name: 'Busy', slug: 'has-products' })
    renderRoute('/admin/categories')

    // Cancel keeps it
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete Old' }),
    )
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Cancel',
      }),
    )
    expect(screen.getByRole('rowheader', { name: 'Old' })).toBeInTheDocument()

    // Confirm deletes it
    await userEvent.click(screen.getByRole('button', { name: 'Delete Old' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete category' }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      '"Old" was deleted.',
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('rowheader', { name: 'Old' }),
      ).not.toBeInTheDocument(),
    )

    // The server refuses (409): the message is shown
    await userEvent.click(screen.getByRole('button', { name: 'Delete Busy' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete category' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'still has products',
    )
  })
})
