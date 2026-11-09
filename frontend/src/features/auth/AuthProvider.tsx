import { useEffect, useState, type ReactNode } from 'react'
import {
  fetchCurrentUser,
  logIn as apiLogIn,
  logOut as apiLogOut,
} from './authApi'
import { AuthContext, type AuthState } from './AuthContext'

/** Finds out once, at start-up, who is logged in, and keeps it up to date. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    fetchCurrentUser().then(
      (user) =>
        active &&
        setAuth(
          user ? { status: 'authenticated', user } : { status: 'anonymous' },
        ),
      // If the API can't be reached, treat the visitor as not logged in.
      () => active && setAuth({ status: 'anonymous' }),
    )
    return () => {
      active = false
    }
  }, [])

  async function logIn(email: string, password: string) {
    await apiLogIn(email, password)
    const user = await fetchCurrentUser()
    if (!user) throw new Error('Login succeeded but no session was created.')
    setAuth({ status: 'authenticated', user })
    return user
  }

  async function logOut() {
    try {
      await apiLogOut()
    } finally {
      // Even if the request fails, forget the user in this browser tab.
      setAuth({ status: 'anonymous' })
    }
  }

  return <AuthContext value={{ auth, logIn, logOut }}>{children}</AuthContext>
}
