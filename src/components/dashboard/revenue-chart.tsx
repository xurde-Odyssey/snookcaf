"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { demoRevenue } from "@/features/dashboard/fixtures";
import { formatMoney } from "@/lib/format";
export function RevenueChart() {
  return (
    <div
      className="h-60 w-full"
      role="img"
      aria-label="Illustrative hourly revenue chart, not actual sales. Snooker and café sample revenue from 10 am to 10 pm."
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={demoRevenue}
          margin={{ top: 12, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="orangeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF7417" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#FF7417" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#E5E7EB"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#6B7280" }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#6B7280" }}
            tickFormatter={(v) => `${Number(v) / 1000}k`}
          />
          <Tooltip
            formatter={(value) => formatMoney(Number(value))}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="snooker"
            name="Snooker"
            stroke="#FF7417"
            strokeWidth={2.5}
            fill="url(#orangeFill)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="cafe"
            name="Café"
            stroke="#596970"
            strokeWidth={2}
            fill="transparent"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
