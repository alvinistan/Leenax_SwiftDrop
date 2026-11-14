import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney } from '../../../lib/money'
import type { ShippingSummary } from '../shippingApi'
import { periodLabel, type Breakdown } from './chartData'
import { CHART, toNumber } from './chartTheme'
import { ChartFigure } from './ChartFigure'

type Series = ShippingSummary['series']

const lkr = (value: number) =>
  new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 }).format(value)

const axisProps = {
  stroke: CHART.grid,
  tick: { fill: CHART.axis, fontSize: 12 },
  tickLine: false,
} as const

const tooltipStyle = {
  contentStyle: { borderRadius: 8, borderColor: '#e7e5e4', fontSize: 13 },
  labelStyle: { color: CHART.text, fontWeight: 600 },
}

function Table({
  head,
  rows,
}: {
  head: string[]
  rows: (string | number)[][]
}) {
  return (
    <table className="w-full text-left">
      <thead className="text-slate-600">
        <tr>
          {head.map((h, i) => (
            <th
              key={h}
              scope="col"
              className={`py-1 pr-3 font-semibold ${i > 0 ? 'text-right' : ''}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={String(r[0])}>
            {r.map((cell, i) =>
              i === 0 ? (
                <th key={i} scope="row" className="py-1 pr-3 font-normal">
                  {cell}
                </th>
              ) : (
                <td key={i} className="py-1 pr-3 text-right">
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Delivery charged vs courier costs per period (same unit: one axis). */
export function ChargedVsCostsChart({ series }: { series: Series }) {
  const data = series.map((p) => ({
    period: periodLabel(p.period),
    charged: toNumber(p.deliveryCharged.amount),
    costs: toNumber(p.courierCosts.amount),
  }))
  return (
    <ChartFigure
      title="Delivery charged vs courier costs"
      summary={`Delivery charged to customers and courier costs for ${series.length} periods. The table below lists the numbers.`}
      table={
        <Table
          head={['Period', 'Shipments', 'Delivery charged', 'Courier costs']}
          rows={series.map((p) => [
            periodLabel(p.period),
            p.shipments,
            formatMoney(p.deliveryCharged),
            formatMoney(p.courierCosts),
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barGap={2}
          margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="period" {...axisProps} minTickGap={12} />
          <YAxis
            {...axisProps}
            axisLine={false}
            tickFormatter={lkr}
            width={64}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v) => `LKR ${lkr(Number(v))}`}
            cursor={{ fill: '#f5f5f4' }}
          />
          <Legend
            iconType="square"
            itemSorter={null}
            wrapperStyle={{ fontSize: 13 }}
            // Legend text stays in the text colour; the square carries the series colour.
            formatter={(value) => (
              <span style={{ color: CHART.text }}>{value}</span>
            )}
          />
          <Bar
            dataKey="charged"
            name="Delivery charged"
            fill={CHART.charged}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
          <Bar
            dataKey="costs"
            name="Courier costs"
            fill={CHART.costs}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  )
}

/** Gross margin per period: above zero blue, below zero red (and labelled in the table). */
export function MarginChart({ series }: { series: Series }) {
  const data = series.map((p) => ({
    period: periodLabel(p.period),
    margin: toNumber(p.grossMargin.amount),
  }))
  return (
    <ChartFigure
      title="Gross shipping margin"
      note="Delivery charged minus courier costs, for parcels where both are known. Not net profit. Red bars are losses."
      summary={`Gross shipping margin for ${series.length} periods; bars below zero are losses. The table below lists the numbers.`}
      table={
        <Table
          head={['Period', 'Gross margin']}
          rows={series.map((p) => [
            periodLabel(p.period),
            formatMoney(p.grossMargin),
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="period" {...axisProps} minTickGap={12} />
          <YAxis
            {...axisProps}
            axisLine={false}
            tickFormatter={lkr}
            width={64}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v) => `LKR ${lkr(Number(v))}`}
            cursor={{ fill: '#f5f5f4' }}
          />
          <Bar
            dataKey="margin"
            name="Gross margin"
            radius={[4, 4, 4, 4]}
            maxBarSize={24}
          >
            {data.map((d) => (
              <Cell
                key={d.period}
                fill={d.margin < 0 ? CHART.loss : CHART.gain}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  )
}

/** A single-series horizontal bar chart (e.g. shipments per courier). */
export function BreakdownChart({
  title,
  unit,
  rows,
}: {
  title: string
  unit: string
  rows: Breakdown
}) {
  return (
    <ChartFigure
      title={title}
      height={Math.max(112, rows.length * 40 + 48)}
      summary={`${title}: ${rows.map((r) => `${r.label} ${r.value}`).join(', ') || 'no data'}.`}
      table={
        <Table
          head={
            rows.some((r) => r.extra) ? ['', unit, 'Courier costs'] : ['', unit]
          }
          rows={rows.map((r) =>
            r.extra ? [r.label, r.value, r.extra] : [r.label, r.value],
          )}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="flex h-full items-center justify-center text-sm text-slate-500">
          No shipments in this period.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART.grid} />
            <XAxis type="number" {...axisProps} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="label"
              {...axisProps}
              axisLine={false}
              width={120}
            />
            <Tooltip {...tooltipStyle} cursor={{ fill: '#f5f5f4' }} />
            <Bar
              dataKey="value"
              name={unit}
              fill={CHART.single}
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFigure>
  )
}
