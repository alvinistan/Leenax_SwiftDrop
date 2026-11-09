import { createContext, useContext } from 'react'
import type { CurrentUser } from './authApi'

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: CurrentUser }

export type AuthContextValue = {
  auth: AuthState
  /** Throws ApiError (401 = wrong email or password). */
  logIn: (email: string, password: string) => Promise<CurrentUser>
  logOut: () => Promise<void>
}

/**
 * React Context: shares one value with every component below the provider,
 * without passing props through every level.
 */
export const AuthContext = createContext<AuthContextValue | null>(null)

/** Who is logged in, plus logIn/logOut. Use inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

export function isAdmin(auth: AuthState): boolean {
  return auth.status === 'authenticated' && auth.user.roles.includes('ADMIN')
}
