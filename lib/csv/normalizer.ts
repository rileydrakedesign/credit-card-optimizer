import { NormalizedTransaction, ColumnMapping, ParsedCSV, AppCategory, CardCategory } from '@/lib/types';
import { categorizeTransaction } from '@/lib/categorize/engine';

export function normalizeTransactions(
  parsed: ParsedCSV,
  mapping: ColumnMapping
): NormalizedTransaction[] {
  const transactions: NormalizedTransaction[] = [];
  const dateIdx = parsed.headers.indexOf(mapping.date);
  const descIdx = parsed.headers.indexOf(mapping.description);
  const amountIdx = mapping.amount ? parsed.headers.indexOf(mapping.amount) : -1;
  const debitIdx = mapping.debit ? parsed.headers.indexOf(mapping.debit) : -1;
  const creditIdx = mapping.credit ? parsed.headers.indexOf(mapping.credit) : -1;

  for (const row of parsed.rows) {
    const rawDate = row[dateIdx] || '';
    const description = row[descIdx] || '';
    const date = normalizeDate(rawDate);
    if (!date || !description) continue;

    let amount_usd: number;
    if (amountIdx >= 0) {
      amount_usd = parseAmount(row[amountIdx] || '0');
    } else {
      const debit = parseAmount(row[debitIdx] || '0');
      const credit = parseAmount(row[creditIdx] || '0');
      amount_usd = debit > 0 ? debit : credit > 0 ? -credit : 0;
    }

    const { app_category, card_category, excluded, exclude_reason } = categorizeTransaction(description);

    const id = generateStableId(parsed.fileName, date, description, amount_usd);

    transactions.push({
      id,
      source_file: parsed.fileName,
      date,
      description,
      amount_usd,
      app_category,
      card_category,
      excluded,
      exclude_reason,
    });
  }

  return transactions;
}

export function parseAmount(raw: string): number {
  let cleaned = raw.replace(/[$,]/g, '').trim();
  // Handle parentheses for negatives: (123.45) -> -123.45
  const parenMatch = cleaned.match(/^\((.+)\)$/);
  if (parenMatch) {
    cleaned = '-' + parenMatch[1];
  }
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  // Positive = spend, negative = refund/credit
  // Bank statements often show debits as negative, so flip sign: -85.43 (purchase) → 85.43
  if (num < 0) return Math.abs(num);
  return num;
}

export function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // MM/DD/YYYY
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try Date.parse as fallback
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return d.toISOString().split('T')[0];
  }
  return null;
}

export function generateStableId(file: string, date: string, desc: string, amount: number): string {
  const raw = `${file}|${date}|${desc}|${amount.toFixed(2)}`;
  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function deduplicateTransactions(transactions: NormalizedTransaction[]): NormalizedTransaction[] {
  const seen = new Set<string>();
  return transactions.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}
