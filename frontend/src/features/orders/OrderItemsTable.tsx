import { formatMoney } from '../../lib/money'
import type { Money } from '../../types/catalog'
import type { OrderItem } from './ordersApi'

type Props = {
  items: OrderItem[]
  itemsTotal: Money
  taxIncluded: Money
  shipping: Money
  shippingLabel: string
  grandTotal: Money
}

/** Ordered items and totals, exactly as saved with the order. */
export function OrderItemsTable({
  items,
  itemsTotal,
  taxIncluded,
  shipping,
  shippingLabel,
  grandTotal,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Ordered items</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Item
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Quantity
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Price
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((i) => (
            <tr key={i.variantId}>
              <th scope="row" className="px-4 py-3 font-medium text-slate-900">
                {i.productName}
                <span className="block text-xs font-normal text-slate-500">
                  {i.variantLabel}
                  {i.taxName && ` · includes ${i.taxName}`}
                </span>
              </th>
              <td className="px-4 py-3">
                {i.quantity}
                {i.saleUnit === 'KG' ? ' kg' : ''}
              </td>
              <td className="px-4 py-3">
                {formatMoney(i.unitPrice)}
                {i.saleUnit === 'KG' ? ' / kg' : ''}
              </td>
              <td className="px-4 py-3 text-right">
                {formatMoney(i.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-slate-200 text-slate-700">
          <tr>
            <th
              scope="row"
              colSpan={3}
              className="px-4 pt-3 text-right font-normal"
            >
              Items
            </th>
            <td className="px-4 pt-3 text-right">{formatMoney(itemsTotal)}</td>
          </tr>
          {Number(taxIncluded.amount) > 0 && (
            <tr className="text-slate-500">
              <th
                scope="row"
                colSpan={3}
                className="px-4 text-right font-normal"
              >
                Includes tax
              </th>
              <td className="px-4 text-right">{formatMoney(taxIncluded)}</td>
            </tr>
          )}
          <tr>
            <th scope="row" colSpan={3} className="px-4 text-right font-normal">
              Delivery ({shippingLabel})
            </th>
            <td className="px-4 text-right">{formatMoney(shipping)}</td>
          </tr>
          <tr className="text-base font-bold text-slate-900">
            <th scope="row" colSpan={3} className="px-4 pt-1 pb-3 text-right">
              Total
            </th>
            <td className="px-4 pt-1 pb-3 text-right">
              {formatMoney(grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
