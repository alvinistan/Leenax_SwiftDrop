import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, apiJson } from './test/apiResponses'
import { server } from './test/mockApi'
import {
  ADMIN,
  logInMockAdmin,
  logInMockCustomer,
  logInMockStaff,
} from './test/mockAdminApi'
import { renderRoute } from './test/renderRoute'

describe('change password', () => {
  it('needs the current password and two matching new ones', async () => {
    logInMockAdmin()
    renderRoute('/account/password')

    await userEvent.type(
      await screen.findByLabelText('Current password'),
      'not-my-password',
    )
    await userEvent.type(
      screen.getByLabelText('New password'),
      'a-new-long-password',
    )
    await userEvent.type(
      screen.getByLabelText('Repeat new password'),
      'a-different-password',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Change password' }),
    )
    expect(
      await screen.findByText('The two new passwords are not the same.'),
    ).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Repeat new password'))
    await userEvent.type(
      screen.getByLabelText('Repeat new password'),
      'a-new-long-password',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Change password' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your current password is not correct.',
    )

    await userEvent.clear(screen.getByLabelText('Current password'))
    await userEvent.type(
      screen.getByLabelText('Current password'),
      ADMIN.password,
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Change password' }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your password has been changed.',
    )
    expect(screen.getByRole('link', { name: '← Back' })).toHaveAttribute(
      'href',
      '/admin',
    )
  })

  it('is linked for the owner, staff and customers', async () => {
    logInMockAdmin()
    renderRoute('/admin')
    expect(
      await screen.findByRole('link', { name: 'Password' }),
    ).toHaveAttribute('href', '/account/password')
    cleanup()

    logInMockStaff()
    renderRoute('/delivery')
    expect(
      await screen.findByRole('link', { name: 'Password' }),
    ).toHaveAttribute('href', '/account/password')
    cleanup()

    logInMockCustomer()
    renderRoute('/account/orders')
    expect(
      await screen.findByRole('link', { name: 'Change password' }),
    ).toHaveAttribute('href', '/account/password')
  })

  it('sends visitors to log in first', async () => {
    renderRoute('/account/password')
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeInTheDocument()
  })
})

describe('too many attempts', () => {
  it('shows the server’s wait message when logging in is locked', async () => {
    server.use(
      http.post(`${API}/api/auth/login`, () =>
        apiJson(
          {
            title: 'Too Many Requests',
            status: 429,
            detail:
              'Too many failed logins for this email. Try again in 15 minutes.',
          },
          { status: 429, headers: { 'Retry-After': '900' } },
        ),
      ),
    )
    renderRoute('/login')
    await userEvent.type(
      await screen.findByLabelText('Email address'),
      ADMIN.email,
    )
    await userEvent.type(
      screen.getByLabelText('Password', { exact: true }),
      'anything',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many failed logins for this email. Try again in 15 minutes.',
    )
  })
})
