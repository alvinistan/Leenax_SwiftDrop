/** A random id for one checkout (see placeOrder). Supported by every current browser. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}
