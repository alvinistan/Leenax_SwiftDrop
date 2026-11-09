import { HttpResponse } from 'msw'

/*
 * Shared building blocks for the fake API (no handlers here, so that both
 * mockApi.ts and mockAdminApi.ts can import this file without a cycle).
 */

export const API = 'http://localhost:8080'

/** The test page pretends to be the Vite dev server (see vite.config.ts). */
export const FRONTEND_ORIGIN = 'http://localhost:5173'

const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
  // The app sends its login cookie (withCredentials), so this must be allowed too.
  'Access-Control-Allow-Credentials': 'true',
}

/**
 * A JSON response with the CORS headers the real backend sends (CorsConfig).
 * Without them, jsdom blocks the response, exactly like a real browser would.
 */
export function apiJson(body: unknown, init: ResponseInit = {}) {
  return HttpResponse.json(body as never, {
    ...init,
    headers: { ...corsHeaders, ...init.headers },
  })
}

/** An empty response, e.g. 204 No Content. */
export function apiEmpty(status: number) {
  return new HttpResponse(null, { status, headers: corsHeaders })
}

/**
 * The answer to a CORS "preflight" (OPTIONS) request. Browsers send one before
 * PUT/DELETE and other non-simple requests, asking "may this origin do this?".
 * Same rules as the real backend's CorsConfig.
 */
export function apiPreflight() {
  return new HttpResponse(null, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type,Accept,X-XSRF-TOKEN',
    },
  })
}
