# PayHere card payments — setup and testing

Source: PayHere Knowledge Base, **Checkout API** (last updated 4 Sep 2026),
<https://support.payhere.lk/api-&-mobile-sdk/checkout-api>. Only what that page
documents is used.

## How it works in SwiftDrop

1. At checkout the customer chooses **"Pay online by card (PayHere)"** and places the order.
2. The backend creates a payment attempt and returns the PayHere form fields
   with the **hash**, which is calculated on the server. The merchant secret
   never reaches the browser.
3. The browser posts that form to PayHere (sandbox or live checkout URL), and
   the customer pays on PayHere's page.
4. PayHere sends a **server-to-server notification** to
   `POST /api/payments/payhere/notify`. SwiftDrop accepts it only if:
   - the `md5sig` matches (compared in constant time), and
   - the merchant id, order, amount and currency all match the order.

   Then:
   - status `2` → the order is **paid**;
   - `0` → pending;
   - `-1` → cancelled;
   - `-2` → failed;
   - `-3` → **charge-back**: the order becomes unpaid again and can't be shipped.
5. PayHere sends the customer back to `/account/orders/<number>?payment=return`.
   The page waits up to 1 minute for the notification. The return itself
   proves nothing.
6. **Timeout:** card orders not paid within **2 hours** (`PAYHERE_UNPAID_TIMEOUT`)
   are cancelled and their stock is returned. A payment arriving after that is
   recorded and flagged **"refund it in PayHere"**.

## Settings (`.env` on your PC, a secrets manager in production)

| Variable | Example | Notes |
|---|---|---|
| `PAYHERE_MERCHANT_ID` | `121xxxx` | PayHere → Side menu → Integrations |
| `PAYHERE_MERCHANT_SECRET` | *(from PayHere)* | **Secret. Never commit, never share.** It is specific to each domain/app you add in PayHere |
| `PAYHERE_MODE` | `sandbox` | `live` only after testing |
| `PAYHERE_PUBLIC_API_BASE_URL` | `https://xxxx.trycloudflare.com` | Public https address of **your backend**. PayHere can't reach `localhost` |
| `FRONTEND_BASE_URL` | `http://localhost:5173` | Where PayHere sends the customer back |

Card payment is offered only when the merchant id, the secret and the public
API address are all set.

## Test with your PayHere sandbox account (on your PC)

1. **Register your shop's domain in PayHere** (Sandbox → Side menu →
   Integrations → *Add Domain/App*).
   - Enter the domain the checkout page runs on. PayHere checks the browser's
     Referer against it.
   - Wait for approval (up to 24 h), then copy the **Merchant Secret shown for
     that domain**.
2. **Give your backend a public https address** so PayHere's notification can
   reach it, for example with a tunnel such as Cloudflare Tunnel or ngrok:
   ```
   cloudflared tunnel --url http://localhost:8080
   ```
   Copy the `https://….trycloudflare.com` address it prints.
3. **Put these lines in your `.env`** (never in Git):
   ```
   PAYHERE_MERCHANT_ID=your-sandbox-merchant-id
   PAYHERE_MERCHANT_SECRET=your-sandbox-secret
   PAYHERE_MODE=sandbox
   PAYHERE_PUBLIC_API_BASE_URL=https://xxxx.trycloudflare.com
   FRONTEND_BASE_URL=http://localhost:5173
   ```
4. **Restart the backend.** Checkout now shows "Pay online by card (PayHere)".
5. **Place an order, pay** on the sandbox page with one of the **test cards
   listed in your PayHere sandbox / knowledge base**, and come back. The order
   should show **"Payment received"**, and Admin → Orders shows the PayHere
   payment id.

If PayHere says **"Unauthorized payment request"** (from PayHere's own
troubleshooting list):
- the hash values differ from what was submitted;
- the domain doesn't match the one registered in Integrations;
- the secret belongs to another domain;
- the Referer header is missing;
- there are duplicate domain records.

## Going live (later)

1. Get the PayHere **live** merchant account approved (business documents).
2. Register the real shop domain in the **live** Integrations page and copy its
   live Merchant Secret.
3. Set `PAYHERE_MODE=live`, the live id and secret, and the real
   `PAYHERE_PUBLIC_API_BASE_URL` (https) in the server's secrets. The live URL
   is `https://www.payhere.lk/pay/checkout`. Without `www` it gives error PH-0022.
4. Do one small real payment and refund it in PayHere.
