import { AppCategory } from '@/lib/types';
import { categorizeTransaction, getCardCategory } from '@/lib/categorize/engine';

// --- Plaid detailed category → AppCategory ---
const DETAILED_MAP: Record<string, AppCategory> = {
  'FOOD_AND_DRINK_GROCERIES': 'Groceries',
  'FOOD_AND_DRINK_SUPERMARKETS_AND_GROCERIES': 'Groceries',
  'FOOD_AND_DRINK_RESTAURANTS': 'Dining',
  'FOOD_AND_DRINK_COFFEE': 'Dining',
  'FOOD_AND_DRINK_FAST_FOOD': 'Dining',
  'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR': 'Dining',
  'TRAVEL_FLIGHTS': 'Airfare',
  'TRAVEL_LODGING': 'Travel',
  'TRAVEL_RENTAL_CARS': 'Travel',
  'TRAVEL_TAXI': 'Travel',
  'TRANSPORTATION_GAS': 'Gas',
  'GENERAL_MERCHANDISE_PHARMACIES': 'Drugstores',
  'ENTERTAINMENT_MUSIC': 'Streaming',
  'ENTERTAINMENT_TV_AND_MOVIES': 'Streaming',
  'ENTERTAINMENT_SPORTING_EVENTS': 'Entertainment',
  'ENTERTAINMENT_GAMES': 'Entertainment',
};

// --- Plaid primary category → AppCategory ---
const PRIMARY_MAP: Record<string, AppCategory> = {
  'FOOD_AND_DRINK': 'Dining',
  'TRAVEL': 'Travel',
  'TRANSPORTATION': 'Travel',
  'ENTERTAINMENT': 'Entertainment',
  'MEDICAL': 'Health',
  'RENT_AND_UTILITIES': 'Bills & Utilities',
  'GENERAL_MERCHANDISE': 'Shopping',
  'GENERAL_SERVICES': 'Other',
  'PERSONAL_CARE': 'Other',
  'GOVERNMENT_AND_NON_PROFIT': 'Other',
  'HOME_IMPROVEMENT': 'Shopping',
  'BANK_FEES': 'Other',
};

// --- Plaid primary categories that are always excluded ---
const EXCLUDED_PRIMARY = new Set([
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'LOAN_PAYMENTS',
  'INCOME',
]);

// --- Counterparty types that indicate non-purchase transactions ---
const EXCLUDED_COUNTERPARTY_TYPES = new Set([
  'financial_institution',
  'payment_app',
  'income_source',
]);

// --- Confidence levels we trust for Plaid's category ---
const HIGH_CONFIDENCE = new Set(['VERY_HIGH', 'HIGH']);

export interface ClassifyInput {
  personalFinanceCategory: {
    primary: string;
    detailed: string;
    confidence_level?: string | null;
  } | null;
  counterparties: Array<{ type: string; name: string }>;
  paymentChannel: string;
  merchantName: string | null;
  rawName: string;
  description: string;
}

export interface CategoryMapResult {
  app_category: AppCategory;
  card_category: ReturnType<typeof getCardCategory>;
  excluded: boolean;
  exclude_reason?: string;
}

function makeExcluded(reason: string): CategoryMapResult {
  return {
    app_category: 'Transfer/Payment',
    card_category: 'all_other',
    excluded: true,
    exclude_reason: reason,
  };
}

function makeCategory(appCategory: AppCategory): CategoryMapResult {
  return {
    app_category: appCategory,
    card_category: getCardCategory(appCategory),
    excluded: false,
  };
}

/**
 * Resolve Plaid detailed/primary category to AppCategory using lookup tables.
 * Returns null if no mapping found.
 */
function resolvePlaidCategory(
  pfc: { primary: string; detailed: string } | null
): AppCategory | null {
  if (!pfc) return null;
  if (pfc.detailed && DETAILED_MAP[pfc.detailed]) return DETAILED_MAP[pfc.detailed];
  if (pfc.primary && PRIMARY_MAP[pfc.primary]) return PRIMARY_MAP[pfc.primary];
  return null;
}

/**
 * Multi-signal transaction classification pipeline.
 *
 * Priority order:
 * 1. Structural exclusions (counterparty type, payment channel, Plaid excluded categories)
 * 2. Keyword exclusion rules (catches deposits, transfers Plaid may miscategorize)
 * 3. High-confidence Plaid category (trust when VERY_HIGH or HIGH)
 * 4. Low-confidence arbitration (keyword engine vs Plaid)
 * 5. Keyword-only fallback (no Plaid category available)
 * 6. Final fallback → "Other"
 */
export function classifyTransaction(input: ClassifyInput): CategoryMapResult {
  const { personalFinanceCategory, counterparties, paymentChannel, merchantName, rawName, description } = input;

  // === STEP 1: Structural exclusions ===

  // Counterparty type signals non-purchase
  const hasExcludedCounterparty = counterparties.some(
    cp => EXCLUDED_COUNTERPARTY_TYPES.has(cp.type)
  );
  if (hasExcludedCounterparty) {
    const cpName = counterparties.find(cp => EXCLUDED_COUNTERPARTY_TYPES.has(cp.type))?.name;
    return makeExcluded(cpName ? `${cpName} (${counterparties[0].type})` : 'Non-purchase transaction');
  }

  // Plaid primary category is in the excluded set
  if (personalFinanceCategory && EXCLUDED_PRIMARY.has(personalFinanceCategory.primary)) {
    return makeExcluded(
      personalFinanceCategory.primary.replace(/_/g, ' ').toLowerCase()
    );
  }

  // === STEP 2: Keyword exclusion check ===
  // Run against both the derived description and raw bank name for coverage
  const keywordResult = categorizeTransaction(description);
  if (keywordResult.excluded) {
    return {
      app_category: keywordResult.app_category,
      card_category: keywordResult.card_category,
      excluded: true,
      exclude_reason: keywordResult.exclude_reason,
    };
  }
  // Also check the raw bank name if different from description
  if (rawName && rawName !== description) {
    const rawKeywordResult = categorizeTransaction(rawName);
    if (rawKeywordResult.excluded) {
      return {
        app_category: rawKeywordResult.app_category,
        card_category: rawKeywordResult.card_category,
        excluded: true,
        exclude_reason: rawKeywordResult.exclude_reason,
      };
    }
  }

  // === STEP 3: High-confidence Plaid category ===
  const confidence = personalFinanceCategory?.confidence_level || 'UNKNOWN';
  if (personalFinanceCategory && HIGH_CONFIDENCE.has(confidence)) {
    const plaidCategory = resolvePlaidCategory(personalFinanceCategory);
    if (plaidCategory) return makeCategory(plaidCategory);
  }

  // === STEP 4: Low-confidence arbitration ===
  if (personalFinanceCategory) {
    // Keyword engine found a specific category → prefer it over uncertain Plaid
    if (keywordResult.app_category !== 'Other') {
      return {
        app_category: keywordResult.app_category,
        card_category: keywordResult.card_category,
        excluded: false,
      };
    }
    // Keyword engine returned Other → Plaid's guess is better than nothing
    const plaidCategory = resolvePlaidCategory(personalFinanceCategory);
    if (plaidCategory) return makeCategory(plaidCategory);
  }

  // === STEP 5: Keyword-only fallback ===
  if (keywordResult.app_category !== 'Other') {
    return {
      app_category: keywordResult.app_category,
      card_category: keywordResult.card_category,
      excluded: false,
    };
  }

  // === STEP 6: Final fallback ===
  return makeCategory('Other');
}
