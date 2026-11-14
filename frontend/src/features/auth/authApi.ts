import { http } from '../../api/http'
import { ApiError } from '../../lib/errors'

export type CurrentUser = {
  email: string
  displayName: string
  roles: string[]
}

/** Who is logged in? null if nobody (the API answers 401). */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await http.get<CurrentUser>('/api/auth/me')
    return response.data
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/**
 * Logs in. Spring Security reads ordinary form fields (not JSON), so the
 * body is URL-encoded: email=...&password=... The session cookie it sets is
 * HttpOnly: this code never sees it, and neither could an injected script.
 */
export async function logIn(email: string, password: string): Promise<void> {
  await http.post('/api/auth/login', new URLSearchParams({ email, password }))
}

export async function logOut(): Promise<void> {
  await http.post('/api/auth/logout')
}

/** Creates a CUSTOMER account. 409 = an account with this email exists. */
export async function register(input: {
  email: string
  password: string
  displayName: string
}): Promise<void> {
  await http.post('/api/auth/register', input)
}
