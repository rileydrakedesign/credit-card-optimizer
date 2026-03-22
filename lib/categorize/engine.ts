import categoryRulesData from '@/data/category_rules.json';
import { AppCategory, CardCategory, CategoryRulesData } from '@/lib/types';

const rules = categoryRulesData as CategoryRulesData;

interface CategorizationResult {
  app_category: AppCategory;
  card_category: CardCategory;
  excluded: boolean;
  exclude_reason?: string;
}

export function categorizeTransaction(description: string): CategorizationResult {
  const lower = description.toLowerCase();

  // Check exclusions first
  for (const rule of rules.exclusion_rules) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return {
          app_category: 'Transfer/Payment',
          card_category: 'all_other',
          excluded: true,
          exclude_reason: rule.reason,
        };
      }
    }
  }

  // Check category rules
  for (const rule of rules.category_rules) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        const rawCat = rules.app_to_card_category[rule.category] || 'all_other';
        const cardCat = (rawCat === 'excluded' ? 'all_other' : rawCat) as CardCategory;
        return {
          app_category: rule.category as AppCategory,
          card_category: cardCat,
          excluded: false,
        };
      }
    }
  }

  // Fallback
  return {
    app_category: 'Other',
    card_category: 'all_other',
    excluded: false,
  };
}

export function getCardCategory(appCategory: AppCategory): CardCategory {
  const mapping = rules.app_to_card_category[appCategory];
  if (!mapping || mapping === 'excluded') return 'all_other';
  return mapping as CardCategory;
}
