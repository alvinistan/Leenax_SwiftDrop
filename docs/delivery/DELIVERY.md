# Delivery management (Phase 10)

**Owner decision D-7 (2026-11-15):** couriers (DEX now, DHL later) **plus your own staff** for nearby orders.
- **Cash on delivery** counts as paid only when the cash reaches you.
- **Proof of delivery** is the receiver's name.

## Set up own delivery (once)
1. **Shipping → Rate cards → New:** choose *Local delivery by our staff*, country Sri Lanka, and enter your prices by weight.
2. **Shipping → Couriers → SwiftDrop own delivery:**
   - tick *Use SwiftDrop own delivery for quotes*;
   - enter the **postal codes you cover**, e.g. `40000, 40010`;
   - save.
   - Customers whose postal code is in the list see "SwiftDrop own delivery" at checkout. Others don't.
   - The order is priced again on the server with the order's own postal code, so a customer can't get it by editing the page.
3. **Delivery → Delivery staff:** add each person (name, email, a password of at least 12 characters). Tell them the password in person.

## Daily work
1. **Confirm the order.** On the order page click *Record shipment*:
   - choose *SwiftDrop own delivery*;
   - leave *Our reference* empty to get a reference like `LD-000012`;
   - choose who delivers it (or choose later on the shipment page).
2. **The staff member logs in on their phone** with the normal login page. They see **only their own parcels**, with the address, a call button, the items and the cash to collect. They tap:
   - **Start delivery** (the order becomes *Shipped*);
   - **Delivered:** enter who received it and tick "I collected LKR … in cash" for COD orders;
   - or **Could not deliver:** choose a reason (nobody at home, wrong address, phone unreachable, refused, cash not ready, other + note), then start again later.
3. **Once it is delivered** the address and phone disappear from the staff member's view.
4. **Delivery → Cash on delivery** shows the cash a staff member or a courier (DEX) still holds. When you receive it, tick the orders, add a reference (e.g. the DEX remittance number) and click **Mark … received**. The orders become *Paid*.
   - Marking a COD order paid on the order page also clears it from this list.

## Couriers (DEX)
- A failed attempt can be recorded with a reason: choose *Problem (exception)*, then the reason.
- *Delivered* can include who received it (optional for couriers).
- A delivered COD parcel is listed as cash held by the courier until DEX pays you.

## Security and privacy
- Staff accounts have the **DELIVERY** role only: no admin pages, no customer pages.
- Every `/api/delivery/**` request checks that:
  - the parcel is assigned to that person;
  - it is not finished;
  - the account is still enabled. **Disabling someone cuts off a session that is already open.**
- Someone with unfinished parcels can't be disabled: give their parcels to someone else first.
- Customers see the failure reason and the receiver's name. They **never** see staff emails, notes or costs.
- Staff accounts, assignments and cash receipts are recorded in **Shipping → Change history**. Passwords are never recorded.

## Not built (yet)
- Photos or signatures as proof (the owner chose the receiver's name).
- Customer emails or SMS when a delivery fails (needs D-13, the email provider).
- Staff changing their own password (the owner sets a new one), and route planning or maps.
