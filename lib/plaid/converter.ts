import { NormalizedTransaction } from '@/lib/types';
import { classifyTransaction } from './category-map';
import type { Transaction as PlaidTransaction } from 'plaid';

export function convertPlaidTransaction(
  txn: PlaidTransaction,
  institutionName: string
): NormalizedTransaction | null {
  // Skip pending transactions
  if (txn.pending) return null;

  const description = txn.merchant_name || txn.name;

  const categoryResult = classifyTransaction({
    personalFinanceCategory: txn.personal_finance_category
      ? {
          primary: txn.personal_finance_category.primary,
          detailed: txn.personal_finance_category.detailed,
          confidence_level: txn.personal_finance_category.confidence_level,
        }
      : null,
    counterparties: (txn.counterparties || []).map(cp => ({
      type: cp.type,
      name: cp.name,
    })),
    paymentChannel: txn.payment_channel,
    merchantName: txn.merchant_name ?? null,
    rawName: txn.name,
    description,
  });

  return {
    id: txn.transaction_id,
    source_file: institutionName,
    date: txn.date,
    description,
    amount_usd: txn.amount,
    raw_category: txn.personal_finance_category?.detailed
      || txn.personal_finance_category?.primary
      || undefined,
    app_category: categoryResult.app_category,
    card_category: categoryResult.card_category,
    excluded: categoryResult.excluded,
    exclude_reason: categoryResult.exclude_reason,
  };
}

export function convertPlaidTransactions(
  txns: PlaidTransaction[],
  institutionName: string
): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];
  for (const txn of txns) {
    const converted = convertPlaidTransaction(txn, institutionName);
    if (converted) results.push(converted);
  }
  return results;
}
