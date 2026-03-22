"use client";

import { useMemo } from "react";
import { NormalizedTransaction } from "@/lib/types";
import { formatCurrency, formatPercent, formatDateRange, getDateRange } from "@/lib/utils/helpers";
import AnimatedNumber from "@/components/AnimatedNumber";

interface Props {
  transactions: NormalizedTransaction[];
}

export default function InsightsSection({ transactions }: Props) {
  const insights = useMemo(() => {
    const included = transactions.filter(t => !t.excluded && t.amount_usd > 0);
    const excluded = transactions.filter(t => t.excluded);
    const refunds = transactions.filter(t => !t.excluded && t.amount_usd < 0);

    const totalIncluded = included.reduce((s, t) => s + t.amount_usd, 0);
    const totalExcluded = excluded.reduce((s, t) => s + Math.abs(t.amount_usd), 0);
    const totalRefunds = refunds.reduce((s, t) => s + Math.abs(t.amount_usd), 0);

    const dates = transactions.map(t => t.date);
    const { min, max } = getDateRange(dates);

    const byCategory: Record<string, number> = {};
    for (const t of included) {
      byCategory[t.app_category] = (byCategory[t.app_category] || 0) + t.amount_usd;
    }
    const categories = Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const excludeReasons: Record<string, number> = {};
    for (const t of excluded) {
      const reason = t.exclude_reason || "Unknown";
      excludeReasons[reason] = (excludeReasons[reason] || 0) + 1;
    }

    return { included, totalIncluded, excluded, totalExcluded, refunds, totalRefunds, min, max, categories, excludeReasons };
  }, [transactions]);

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4">Spending Insights</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Date Range" text={formatDateRange(insights.min, insights.max)} />
        <StatCard label="Total Spend">
          <AnimatedNumber value={insights.totalIncluded} format="currency" />
          <span className="text-xs text-gray-500 block">{insights.included.length} transactions</span>
        </StatCard>
        <StatCard label="Excluded">
          <AnimatedNumber value={insights.totalExcluded} format="currency" />
          <span className="text-xs text-gray-500 block">{insights.excluded.length} transactions</span>
        </StatCard>
        <StatCard label="Refunds">
          <AnimatedNumber value={insights.totalRefunds} format="currency" />
          <span className="text-xs text-gray-500 block">{insights.refunds.length} transactions</span>
        </StatCard>
      </div>

      {/* Category breakdown */}
      <div className="border rounded-lg dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-right px-4 py-3 font-medium">% of Spend</th>
              <th className="px-4 py-3 font-medium">Distribution</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {insights.categories.map(({ category, amount }) => (
              <tr key={category} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium">{category}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(amount)}</td>
                <td className="px-4 py-3 text-right">{formatPercent(amount, insights.totalIncluded)}</td>
                <td className="px-4 py-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-700"
                      style={{ width: `${(amount / insights.totalIncluded) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {insights.excluded.length > 0 && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
          <p className="font-medium mb-1">Excluded Transactions</p>
          {Object.entries(insights.excludeReasons).map(([reason, count]) => (
            <p key={reason} className="text-gray-600 dark:text-gray-400">{reason}: {count}</p>
          ))}
        </div>
      )}
    </section>
  );
}

function StatCard({ label, text, children }: { label: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4 dark:border-gray-700">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {text ? <p className="text-lg font-semibold">{text}</p> : <div className="text-lg font-semibold">{children}</div>}
    </div>
  );
}
