"use client";

import { useState, useMemo } from "react";
import { NormalizedTransaction, CardSimulationResult, AppCategory } from "@/lib/types";
import { formatCurrency, formatNumber, formatRewardCurrency, formatDateRange, getDateRange } from "@/lib/utils/helpers";
import AnimatedNumber from "@/components/AnimatedNumber";
import TransactionsTab from "@/components/TransactionsTab";

interface Props {
  transactions: NormalizedTransaction[];
  simResults: CardSimulationResult[];
  onCategoryOverride: (txnId: string, newCategory: AppCategory) => void;
}

export default function ResultsView({ transactions, simResults, onCategoryOverride }: Props) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);

  // Single ranked list — cash back cards by net value, others by total units
  const ranked = useMemo(() => {
    return [...simResults].sort((a, b) => {
      // Cash back cards first, sorted by net cash back
      if (a.is_cash_back && b.is_cash_back) return b.net_cash_back_usd - a.net_cash_back_usd;
      if (a.is_cash_back) return -1;
      if (b.is_cash_back) return 1;
      return b.total_units - a.total_units;
    });
  }, [simResults]);

  const hero = ranked[0];
  const rest = ranked.slice(1);

  // Spending summary
  const spending = useMemo(() => {
    const included = transactions.filter(t => !t.excluded && t.amount_usd > 0);
    const total = included.reduce((s, t) => s + t.amount_usd, 0);
    const dates = transactions.map(t => t.date);
    const { min, max } = getDateRange(dates);

    const byCategory: Record<string, number> = {};
    for (const t of included) {
      byCategory[t.app_category] = (byCategory[t.app_category] || 0) + t.amount_usd;
    }
    const categories = Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { total, categories, min, max, count: included.length };
  }, [transactions]);

  const colors = [
    "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500",
    "bg-violet-500", "bg-orange-500", "bg-pink-500", "bg-teal-500",
    "bg-indigo-500", "bg-lime-500", "bg-blue-500", "bg-red-500",
  ];

  if (!hero) return null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Hero — #1 Card */}
      <div className="mb-12">
        <p className="text-sm font-medium text-emerald-400 uppercase tracking-widest mb-3">Your best card</p>
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold mb-1">{hero.card.name}</h2>
              <p className="text-[var(--muted)]">{hero.card.issuer} · {hero.card.network}</p>
            </div>
            <div className="text-right">
              {hero.is_cash_back ? (
                <>
                  <p className="text-5xl font-bold text-emerald-400">
                    <AnimatedNumber value={hero.net_cash_back_usd} format="currency" />
                  </p>
                  <p className="text-[var(--muted)] mt-1">
                    {hero.annual_fee_usd > 0
                      ? `${formatCurrency(hero.cash_back_usd)} earned · ${formatCurrency(hero.annual_fee_usd)}/yr fee`
                      : "net cash back · no annual fee"}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-5xl font-bold text-emerald-400">
                    <AnimatedNumber value={hero.total_units} />
                  </p>
                  <p className="text-[var(--muted)] mt-1">
                    {formatRewardCurrency(hero.reward_currency)}
                    {hero.annual_fee_usd > 0 && ` · ${formatCurrency(hero.annual_fee_usd)}/yr fee`}
                    {hero.annual_fee_usd === 0 && " · no annual fee"}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Hero category breakdown */}
          <div className="mt-6 pt-6 border-t border-[var(--border)] grid grid-cols-2 md:grid-cols-4 gap-4">
            {hero.breakdown.slice(0, 4).map(b => (
              <div key={b.category}>
                <p className="text-xs text-[var(--muted)] mb-1">{b.category}</p>
                <p className="font-semibold">
                  {hero.is_cash_back ? formatCurrency(b.cashBack) : formatNumber(b.units)}
                </p>
                <p className="text-xs text-[var(--muted)]">{formatCurrency(b.spend)} spent</p>
              </div>
            ))}
          </div>

          {hero.caps_hit.length > 0 && (
            <p className="mt-4 text-sm text-amber-400">
              Spending caps reached: {hero.caps_hit.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Ranked list — remaining cards */}
      {rest.length > 0 && (
        <div className="mb-12">
          <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-widest mb-4">All cards ranked</h3>
          <div className="space-y-2">
            {rest.map((r, i) => (
              <CardRow
                key={r.card.id}
                result={r}
                rank={i + 2}
                expanded={expandedCard === r.card.id}
                onToggle={() => setExpandedCard(expandedCard === r.card.id ? null : r.card.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Spending summary */}
      <div className="mb-12">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-widest">Your spending</h3>
          <p className="text-sm text-[var(--muted)]">
            {formatDateRange(spending.min, spending.max)} · {formatCurrency(spending.total)} across {spending.count} transactions
          </p>
        </div>
        <div className="space-y-2">
          {spending.categories.map(({ category, amount }, i) => (
            <div key={category} className="flex items-center gap-3">
              <span className="w-28 text-sm text-right text-[var(--muted)] truncate">{category}</span>
              <div className="flex-1 bg-[var(--surface)] rounded-full h-5 overflow-hidden">
                <div
                  className={`${colors[i % colors.length]} h-5 rounded-full transition-all duration-700 flex items-center px-2`}
                  style={{ width: `${Math.max((amount / spending.total) * 100, 3)}%` }}
                >
                  <span className="text-white text-xs font-medium truncate">
                    {((amount / spending.total) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <span className="w-20 text-sm text-right font-medium">{formatCurrency(amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions toggle */}
      <div className="border-t border-[var(--border)] pt-6">
        <button
          onClick={() => setShowTransactions(!showTransactions)}
          className="text-sm text-[var(--muted)] hover:text-white transition-colors"
        >
          {showTransactions
            ? "Hide transactions"
            : `View all ${transactions.length} transactions`}
        </button>
        {showTransactions && (
          <div className="mt-4">
            <TransactionsTab transactions={transactions} onCategoryOverride={onCategoryOverride} />
          </div>
        )}
      </div>
    </div>
  );
}

function CardRow({ result, rank, expanded, onToggle }: {
  result: CardSimulationResult;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const r = result;

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-light)] transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-[var(--muted)] w-6">#{rank}</span>
          <div>
            <p className="font-semibold">{r.card.name}</p>
            <p className="text-xs text-[var(--muted)]">{r.card.issuer}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            {r.is_cash_back ? (
              <p className="font-bold text-emerald-400">{formatCurrency(r.net_cash_back_usd)}</p>
            ) : (
              <p className="font-bold text-emerald-400">
                {formatNumber(r.total_units)} <span className="text-xs font-normal text-[var(--muted)]">{r.is_points ? "pts" : "mi"}</span>
              </p>
            )}
            <p className="text-xs text-[var(--muted)]">
              {r.annual_fee_usd > 0 ? `${formatCurrency(r.annual_fee_usd)}/yr` : "No fee"}
            </p>
          </div>
          <span className={`text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`}>
            ▾
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-[var(--border)] pt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {r.breakdown.slice(0, 4).map(b => (
              <div key={b.category}>
                <p className="text-xs text-[var(--muted)]">{b.category}</p>
                <p className="font-semibold text-sm">
                  {r.is_cash_back ? formatCurrency(b.cashBack) : formatNumber(b.units)}
                </p>
                <p className="text-xs text-[var(--muted)]">{formatCurrency(b.spend)} spent</p>
              </div>
            ))}
          </div>
          {r.caps_hit.length > 0 && (
            <p className="mt-3 text-xs text-amber-400">
              Spending caps reached: {r.caps_hit.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
