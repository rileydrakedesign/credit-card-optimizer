export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

export function formatRewardCurrency(currency: string): string {
  const map: Record<string, string> = {
    cash_back: 'Cash Back',
    cash_rewards: 'Cash Rewards',
    cash_back_or_ultimate_rewards: 'Cash Back / Ultimate Rewards',
    ultimate_rewards_points: 'Ultimate Rewards Points',
    membership_rewards_points: 'Membership Rewards Points',
    thankyou_points_redeemable_for_cash: 'ThankYou Points',
    miles: 'Miles',
  };
  return map[currency] || currency.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getDateRange(dates: string[]): { min: string; max: string } {
  if (dates.length === 0) return { min: '', max: '' };
  const sorted = [...dates].sort();
  return { min: sorted[0], max: sorted[sorted.length - 1] };
}

export function formatDateRange(min: string, max: string): string {
  if (!min || !max) return 'N/A';
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  const minDate = new Date(min + 'T00:00:00');
  const maxDate = new Date(max + 'T00:00:00');
  return `${minDate.toLocaleDateString('en-US', opts)} – ${maxDate.toLocaleDateString('en-US', opts)}`;
}
