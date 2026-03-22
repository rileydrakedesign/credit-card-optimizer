"use client";

import { useState } from "react";
import { NormalizedTransaction, CardSimulationResult, AppCategory } from "@/lib/types";
import TransactionsTab from "@/components/TransactionsTab";
import RecommendationsTab from "@/components/RecommendationsTab";

interface Props {
  transactions: NormalizedTransaction[];
  simResults: CardSimulationResult[];
  onCategoryOverride: (txnId: string, newCategory: AppCategory) => void;
}

const TABS = ["Transactions", "Spending by Category", "Card Recommendations"] as const;

export default function TabsSection({ transactions, simResults, onCategoryOverride }: Props) {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Card Recommendations");

  return (
    <section>
      <div className="flex border-b dark:border-gray-700 mb-6">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Transactions" && (
        <TransactionsTab transactions={transactions} onCategoryOverride={onCategoryOverride} />
      )}

      {activeTab === "Spending by Category" && (
        <SpendingByCategoryTab transactions={transactions} />
      )}

      {activeTab === "Card Recommendations" && (
        <RecommendationsTab results={simResults} />
      )}
    </section>
  );
}

function SpendingByCategoryTab({ transactions }: { transactions: NormalizedTransaction[] }) {
  const included = transactions.filter(t => !t.excluded && t.amount_usd > 0);
  const total = included.reduce((s, t) => s + t.amount_usd, 0);

  const byCategory: Record<string, { amount: number; count: number }> = {};
  for (const t of included) {
    if (!byCategory[t.app_category]) byCategory[t.app_category] = { amount: 0, count: 0 };
    byCategory[t.app_category].amount += t.amount_usd;
    byCategory[t.app_category].count++;
  }

  const categories = Object.entries(byCategory)
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.amount - a.amount);

  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
    "bg-violet-500", "bg-cyan-500", "bg-orange-500", "bg-pink-500",
    "bg-teal-500", "bg-indigo-500", "bg-lime-500", "bg-red-500",
  ];

  return (
    <div>
      {/* Bar chart */}
      <div className="mb-6 space-y-2">
        {categories.map(({ category, amount }, i) => (
          <div key={category} className="flex items-center gap-3">
            <span className="w-32 text-sm text-right truncate">{category}</span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-6 overflow-hidden">
              <div
                className={`${colors[i % colors.length]} h-6 rounded-full transition-all duration-700 flex items-center px-2`}
                style={{ width: `${(amount / total) * 100}%`, minWidth: '2rem' }}
              >
                <span className="text-white text-xs font-medium truncate">
                  {((amount / total) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <span className="w-24 text-sm text-right font-medium">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
