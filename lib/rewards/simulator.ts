import { NormalizedTransaction, CreditCard, CardSimulationResult, CategoryBreakdown, EarnRule } from '@/lib/types';

function isCashBackCurrency(currency: string): boolean {
  const cashCurrencies = ['cash_back', 'cash_rewards', 'cash_back_or_ultimate_rewards'];
  return cashCurrencies.includes(currency);
}

function isMilesCurrency(currency: string): boolean {
  return currency === 'miles';
}

function getQuarterKey(date: string): string {
  const d = new Date(date);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function getMonthKey(date: string): string {
  return date.substring(0, 7); // YYYY-MM
}

function getYearKey(date: string): string {
  return date.substring(0, 4);
}

function computeReward(spend: number, multiplier: number, unit: string, rewardCurrency: string): { units: number; cashBack: number } {
  if (unit === 'percent_cash_back') {
    return { units: 0, cashBack: spend * (multiplier / 100) };
  }
  if (unit === 'points_per_dollar') {
    return { units: spend * multiplier, cashBack: 0 };
  }
  if (unit === 'miles_per_dollar') {
    return { units: spend * multiplier, cashBack: 0 };
  }
  if (unit === 'percent_or_points_per_dollar') {
    if (isCashBackCurrency(rewardCurrency)) {
      return { units: 0, cashBack: spend * (multiplier / 100) };
    }
    return { units: spend * multiplier, cashBack: 0 };
  }
  return { units: 0, cashBack: 0 };
}

function findFallbackRule(card: CreditCard): EarnRule | null {
  return card.earn_rules.find(r => r.category === 'all_purchases')
    || card.earn_rules.find(r => r.category === 'all_other')
    || null;
}

function findMatchingRule(card: CreditCard, cardCategory: string): EarnRule | null {
  // Skip special categories
  const specialCategories = ['rotating_bonus_categories', 'top_eligible_category_each_billing_cycle'];
  const match = card.earn_rules.find(r =>
    r.category === cardCategory && !specialCategories.includes(r.category)
  );
  return match || null;
}

export function simulateCard(
  card: CreditCard,
  transactions: NormalizedTransaction[],
  activatedCards: Set<string> = new Set()
): CardSimulationResult {
  const includedTxns = transactions.filter(t => !t.excluded && t.amount_usd > 0);

  // Track cap usage by period
  const capUsage: Record<string, number> = {};
  let totalUnits = 0;
  let totalCashBack = 0;
  const breakdownMap: Record<string, { units: number; spend: number }> = {};
  const capsHit: string[] = [];

  // Check for special earn rule types
  const hasRotating = card.earn_rules.some(r => r.category === 'rotating_bonus_categories');
  const hasTopEligible = card.earn_rules.some(r => r.category === 'top_eligible_category_each_billing_cycle');

  // Handle top_eligible_category_each_billing_cycle (Citi Custom Cash style)
  if (hasTopEligible) {
    const topRule = card.earn_rules.find(r => r.category === 'top_eligible_category_each_billing_cycle')!;
    const fallbackRule = findFallbackRule(card);
    const monthlySpend: Record<string, Record<string, number>> = {};

    // Group spend by month and card category
    for (const txn of includedTxns) {
      const month = getMonthKey(txn.date);
      if (!monthlySpend[month]) monthlySpend[month] = {};
      if (!monthlySpend[month][txn.card_category]) monthlySpend[month][txn.card_category] = 0;
      monthlySpend[month][txn.card_category] += txn.amount_usd;
    }

    // For each month, find top category
    const monthTopCategory: Record<string, string> = {};
    for (const [month, categories] of Object.entries(monthlySpend)) {
      let topCat = '';
      let topSpend = 0;
      for (const [cat, spend] of Object.entries(categories)) {
        if (cat !== 'all_other' && cat !== 'all_purchases' && spend > topSpend) {
          topSpend = spend;
          topCat = cat;
        }
      }
      if (topCat) monthTopCategory[month] = topCat;
    }

    // Process transactions
    const monthCapUsage: Record<string, number> = {};
    for (const txn of includedTxns) {
      const month = getMonthKey(txn.date);
      const topCat = monthTopCategory[month];
      const capAmount = topRule.cap?.amount_usd || 500;

      let rule: EarnRule | null = null;
      if (topCat && txn.card_category === topCat) {
        if (!monthCapUsage[month]) monthCapUsage[month] = 0;
        if (monthCapUsage[month] < capAmount) {
          const eligible = Math.min(txn.amount_usd, capAmount - monthCapUsage[month]);
          monthCapUsage[month] += eligible;
          const reward = computeReward(eligible, topRule.multiplier, topRule.unit, card.reward_currency);
          totalUnits += reward.units;
          totalCashBack += reward.cashBack;
          addBreakdown(breakdownMap, txn.card_category, reward.units, eligible);

          const overflow = txn.amount_usd - eligible;
          if (overflow > 0) {
            if (monthCapUsage[month] >= capAmount && !capsHit.includes(`Top category cap ($${capAmount}/month)`)) {
              capsHit.push(`Top category cap ($${capAmount}/month)`);
            }
            if (fallbackRule) {
              const fbReward = computeReward(overflow, fallbackRule.multiplier, fallbackRule.unit, card.reward_currency);
              totalUnits += fbReward.units;
              totalCashBack += fbReward.cashBack;
              addBreakdown(breakdownMap, 'all_other', fbReward.units, overflow);
            }
          }
          continue;
        } else {
          rule = fallbackRule;
        }
      } else {
        rule = fallbackRule;
      }

      if (rule) {
        const reward = computeReward(txn.amount_usd, rule.multiplier, rule.unit, card.reward_currency);
        totalUnits += reward.units;
        totalCashBack += reward.cashBack;
        addBreakdown(breakdownMap, txn.card_category, reward.units, txn.amount_usd);
      }
    }
  } else {
    // Standard simulation
    for (const txn of includedTxns) {
      let rule = findMatchingRule(card, txn.card_category);
      let usedFallback = false;

      if (!rule) {
        rule = findFallbackRule(card);
        usedFallback = true;
      }

      if (!rule) continue;

      let spend = txn.amount_usd;

      // Handle caps
      if (rule.cap) {
        const periodKey = getPeriodKey(txn.date, rule.cap.period);
        const capKey = `${card.id}|${rule.category}|${periodKey}`;
        if (!capUsage[capKey]) capUsage[capKey] = 0;

        if (capUsage[capKey] >= rule.cap.amount_usd) {
          // Cap exceeded, use fallback
          const fb = findFallbackRule(card);
          if (fb && fb !== rule) {
            const reward = computeReward(spend, fb.multiplier, fb.unit, card.reward_currency);
            totalUnits += reward.units;
            totalCashBack += reward.cashBack;
            addBreakdown(breakdownMap, txn.card_category, reward.units, spend);
          }
          continue;
        }

        const eligible = Math.min(spend, rule.cap.amount_usd - capUsage[capKey]);
        capUsage[capKey] += eligible;

        if (capUsage[capKey] >= rule.cap.amount_usd) {
          const capDesc = `${rule.category} cap ($${rule.cap.amount_usd}/${rule.cap.period})`;
          if (!capsHit.includes(capDesc)) capsHit.push(capDesc);
        }

        const reward = computeReward(eligible, rule.multiplier, rule.unit, card.reward_currency);
        totalUnits += reward.units;
        totalCashBack += reward.cashBack;
        addBreakdown(breakdownMap, txn.card_category, reward.units, eligible);

        const overflow = spend - eligible;
        if (overflow > 0) {
          const fb = findFallbackRule(card);
          if (fb && fb !== rule) {
            const fbReward = computeReward(overflow, fb.multiplier, fb.unit, card.reward_currency);
            totalUnits += fbReward.units;
            totalCashBack += fbReward.cashBack;
            addBreakdown(breakdownMap, 'all_other', fbReward.units, overflow);
          }
        }
        continue;
      }

      const reward = computeReward(spend, rule.multiplier, rule.unit, card.reward_currency);
      totalUnits += reward.units;
      totalCashBack += reward.cashBack;
      addBreakdown(breakdownMap, txn.card_category, reward.units, spend);
    }
  }

  // Compute period for annual fee proration
  const dates = includedTxns.map(t => new Date(t.date).getTime());
  const minDate = dates.length ? Math.min(...dates) : Date.now();
  const maxDate = dates.length ? Math.max(...dates) : Date.now();
  const days = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24) + 1);
  const proratedFee = card.annual_fee_usd * (days / 365);

  const isCashBack = isCashBackCurrency(card.reward_currency);
  const isMiles = isMilesCurrency(card.reward_currency);

  const breakdown: CategoryBreakdown[] = Object.entries(breakdownMap)
    .map(([category, data]) => ({ category, units: Math.round(data.units * 100) / 100, spend: Math.round(data.spend * 100) / 100 }))
    .sort((a, b) => b.units - a.units || b.spend - a.spend);

  return {
    card,
    reward_currency: card.reward_currency,
    total_units: Math.round(totalUnits * 100) / 100,
    cash_back_usd: Math.round(totalCashBack * 100) / 100,
    annual_fee_usd: card.annual_fee_usd,
    prorated_fee_usd: Math.round(proratedFee * 100) / 100,
    net_cash_back_usd: Math.round((totalCashBack - proratedFee) * 100) / 100,
    breakdown,
    caps_hit: capsHit,
    is_cash_back: isCashBack,
    is_points: !isCashBack && !isMiles,
    is_miles: isMiles,
  };
}

function addBreakdown(map: Record<string, { units: number; spend: number }>, category: string, units: number, spend: number) {
  if (!map[category]) map[category] = { units: 0, spend: 0 };
  map[category].units += units;
  map[category].spend += spend;
}

function getPeriodKey(date: string, period: string): string {
  switch (period) {
    case 'annual': return getYearKey(date);
    case 'quarterly': return getQuarterKey(date);
    case 'billing_cycle': return getMonthKey(date);
    default: return getYearKey(date);
  }
}

export function simulateAllCards(
  cards: CreditCard[],
  transactions: NormalizedTransaction[],
  activatedCards: Set<string> = new Set()
): CardSimulationResult[] {
  return cards.map(card => simulateCard(card, transactions, activatedCards));
}
