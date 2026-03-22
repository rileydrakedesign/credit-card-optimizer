export type AppCategory =
  | 'Groceries'
  | 'Dining'
  | 'Drugstores'
  | 'Streaming'
  | 'Entertainment'
  | 'Travel'
  | 'Airfare'
  | 'Gas'
  | 'Shopping'
  | 'Bills & Utilities'
  | 'Health'
  | 'Other'
  | 'Transfer/Payment'
  | 'Unknown';

export type CardCategory =
  | 'travel_portal'
  | 'dining'
  | 'drugstores'
  | 'groceries'
  | 'airfare'
  | 'travel'
  | 'streaming'
  | 'entertainment'
  | 'rotating_bonus_categories'
  | 'top_eligible_category_each_billing_cycle'
  | 'all_purchases'
  | 'all_other';

export interface NormalizedTransaction {
  id: string;
  source_file: string;
  date: string; // ISO YYYY-MM-DD
  description: string;
  amount_usd: number; // positive = spend, negative = refund
  raw_category?: string;
  app_category: AppCategory;
  card_category: CardCategory;
  excluded: boolean;
  exclude_reason?: string;
  overridden?: boolean;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
}

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
  fileName: string;
}

export interface EarnRuleCap {
  amount_usd: number;
  period: 'annual' | 'quarterly' | 'billing_cycle';
  applies_to: string;
}

export interface EarnRule {
  category: string;
  subcategory?: string;
  multiplier: number;
  unit: string;
  cap: EarnRuleCap | null;
  notes?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  issuer: string;
  network: string;
  reward_currency: string;
  annual_fee_usd: number;
  activation_required: boolean;
  earn_rules: EarnRule[];
  source_urls: string[];
  last_verified_date: string;
}

export interface CardsData {
  as_of_date: string;
  notes: Record<string, string>;
  cards: CreditCard[];
}

export interface CategoryBreakdown {
  category: string;
  units: number;
  spend: number;
}

export interface CardSimulationResult {
  card: CreditCard;
  reward_currency: string;
  total_units: number;
  cash_back_usd: number;
  annual_fee_usd: number;
  prorated_fee_usd: number;
  net_cash_back_usd: number;
  breakdown: CategoryBreakdown[];
  caps_hit: string[];
  is_cash_back: boolean;
  is_points: boolean;
  is_miles: boolean;
}

export interface ExclusionRule {
  keywords: string[];
  reason: string;
}

export interface CategoryRule {
  category: AppCategory;
  keywords: string[];
}

export interface CategoryRulesData {
  exclusion_rules: ExclusionRule[];
  category_rules: CategoryRule[];
  app_to_card_category: Record<string, string>;
}
