"use client";

import { useState, useMemo } from "react";
import { NormalizedTransaction, AppCategory } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/helpers";

const ALL_CATEGORIES: AppCategory[] = [
  'Groceries', 'Dining', 'Drugstores', 'Streaming', 'Entertainment',
  'Travel', 'Airfare', 'Gas', 'Shopping', 'Bills & Utilities',
  'Health', 'Other', 'Transfer/Payment', 'Unknown',
];

interface Props {
  transactions: NormalizedTransaction[];
  onCategoryOverride: (txnId: string, newCategory: AppCategory) => void;
}

export default function TransactionsTab({ transactions, onCategoryOverride }: Props) {
  const [filter, setFilter] = useState<"all" | "included" | "excluded">("included");

  const filtered = useMemo(() => {
    switch (filter) {
      case "included": return transactions.filter(t => !t.excluded);
      case "excluded": return transactions.filter(t => t.excluded);
      default: return transactions;
    }
  }, [transactions, filter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.date.localeCompare(a.date)), [filtered]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["all", "included", "excluded"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({
              f === "all" ? transactions.length :
              f === "included" ? transactions.filter(t => !t.excluded).length :
              transactions.filter(t => t.excluded).length
            })
          </button>
        ))}
      </div>

      <div className="border rounded-lg dark:border-gray-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Description</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {sorted.map(t => (
              <tr key={t.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${t.excluded ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 whitespace-nowrap">{t.date}</td>
                <td className="px-4 py-3 max-w-xs truncate">{t.description}</td>
                <td className={`px-4 py-3 text-right whitespace-nowrap ${t.amount_usd < 0 ? "text-green-600" : ""}`}>
                  {t.amount_usd < 0 ? "-" : ""}{formatCurrency(Math.abs(t.amount_usd))}
                </td>
                <td className="px-4 py-3">
                  {t.excluded ? (
                    <span className="text-amber-600 text-xs">{t.exclude_reason}</span>
                  ) : (
                    <select
                      value={t.app_category}
                      onChange={(e) => onCategoryOverride(t.id, e.target.value as AppCategory)}
                      className={`text-sm px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 ${t.overridden ? "ring-2 ring-blue-300" : ""}`}
                    >
                      {ALL_CATEGORIES.filter(c => c !== 'Transfer/Payment').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[120px]">{t.source_file}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
