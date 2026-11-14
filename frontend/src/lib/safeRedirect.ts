/** Only allow redirects to pages on this site (never to another website). */
export function safeRedirect(target: string | null): string | null {
  return target && target.startsWith('/') && !target.startsWith('//')
    ? target
    : null
}
