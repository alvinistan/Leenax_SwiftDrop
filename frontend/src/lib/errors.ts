/** The requested item does not exist (the API's 404). Pages show a "not found" message for it. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}
