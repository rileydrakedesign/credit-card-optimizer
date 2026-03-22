"use client";

import { useMemo } from "react";
import { CardSimulationResult } from "@/lib/types";
import { formatCurrency, formatNumber, formatRewardCurrency } from "@/lib/utils/helpers";
import AnimatedNumber from "@/components/AnimatedNumber";

interface Props {
  results: CardSimulationResult[];
}

export default function RecommendationsTab({ results }: Props) {
  const { cashBack, points, miles } = useMemo(() => {
    const cashBack = results
      .filter(r => r.is_cash_back)
      .sort((a, b) => b.cash_back_usd - a.cash_back_usd);

    const pointsMap: Record<string, CardSimulationResult[]> = {};
    for (const r of results) {
      if (r.is_points) {
        if (!pointsMap[r.reward_currency]) pointsMap[r.reward_currency] = [];
        pointsMap[r.reward_currency].push(r);
      }
    }
    for (const key of Object.keys(pointsMap)) {
      pointsMap[key].sort((a, b) => b.total_units - a.total_units);
    }

    const miles = results
      .filter(r => r.is_miles)
      .sort((a, b) => b.total_units - a.total_units);

    return { cashBack, points: pointsMap, miles };
  }, [results]);

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        Rewards shown as units (points/miles) and cash-back dollars. No point valuation is applied in MVP.
      </p>

      {/* Cash Back */}
      {cashBack.length > 0 && (
        <RecommendationSection title="Cash Back Recommendations" results={cashBack.slice(0, 3)} type="cashback" />
      )}

      {/* Points by currency */}
      {Object.entries(points).map(([currency, cards]) => (
        <RecommendationSection
          key={currency}
          title={`${formatRewardCurrency(currency)} Recommendations`}
          results={cards.slice(0, 3)}
          type="points"
        />
      ))}

      {/* Miles */}
      {miles.length > 0 && (
        <RecommendationSection title="Miles Recommendations" results={miles.slice(0, 3)} type="miles" />
      )}
    </div>
  );
}

function RecommendationSection({ title, results, type }: {
  title: string;
  results: CardSimulationResult[];
  type: "cashback" | "points" | "miles";
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {results.map((r, i) => (
          <CardResult key={r.card.id} result={r} rank={i + 1} type={type} />
        ))}
      </div>
    </div>
  );
}

function CardResult({ result, rank, type }: {
  result: CardSimulationResult;
  rank: number;
  type: "cashback" | "points" | "miles";
}) {
  const r = result;
  const rankColors = ["border-yellow-400", "border-gray-400", "border-amber-600"];

  return (
    <div className={`border-2 ${rankColors[rank - 1] || "border-gray-200"} rounded-xl p-4 dark:bg-gray-900`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-bold text-gray-400">#{rank}</span>
          <h4 className="font-semibold">{r.card.name}</h4>
          <p className="text-xs text-gray-500">{r.card.issuer} &middot; {r.card.network}</p>
        </div>
      </div>

      <div className="mb-3">
        {type === "cashback" ? (
          <div>
            <p className="text-2xl font-bold text-emerald-600">
              <AnimatedNumber value={r.cash_back_usd} format="currency" />
            </p>
            <p className="text-xs text-gray-500">cash back earned</p>
            {r.annual_fee_usd > 0 && (
              <p className="text-sm mt-1">
                Net: <span className={r.net_cash_back_usd >= 0 ? "text-emerald-600" : "text-red-500"}>
                  {formatCurrency(r.net_cash_back_usd)}
                </span>
                <span className="text-gray-400 text-xs ml-1">(after {formatCurrency(r.prorated_fee_usd)} pro-rated fee)</span>
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-2xl font-bold text-blue-600">
              <AnimatedNumber value={r.total_units} />
            </p>
            <p className="text-xs text-gray-500">{formatRewardCurrency(r.reward_currency)}</p>
          </div>
        )}
      </div>

      {r.annual_fee_usd > 0 && (
        <p className="text-xs text-gray-500 mb-2">Annual fee: {formatCurrency(r.annual_fee_usd)} ({formatCurrency(r.prorated_fee_usd)} pro-rated)</p>
      )}
      {r.annual_fee_usd === 0 && (
        <p className="text-xs text-emerald-600 mb-2">No annual fee</p>
      )}

      {/* Top contributing categories */}
      <div className="border-t dark:border-gray-700 pt-2 mt-2">
        <p className="text-xs font-medium text-gray-500 mb-1">Top categories:</p>
        {r.breakdown.slice(0, 4).map(b => (
          <div key={b.category} className="flex justify-between text-xs py-0.5">
            <span className="text-gray-600 dark:text-gray-400">{b.category}</span>
            <span className="font-medium">
              {type === "cashback" ? formatCurrency(b.cashBack) : formatNumber(b.units)}
              <span className="text-gray-400 ml-1">({formatCurrency(b.spend)} spend)</span>
            </span>
          </div>
        ))}
      </div>

      {r.caps_hit.length > 0 && (
        <div className="mt-2 text-xs text-amber-600">
          Caps hit: {r.caps_hit.join(", ")}
        </div>
      )}
    </div>
  );
}
