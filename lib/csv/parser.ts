import { ParsedCSV, ColumnMapping } from '@/lib/types';

export function parseCSVText(text: string, fileName: string): ParsedCSV {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) {
    return { headers: [], rows: [], fileName };
  }

  const headers = parseCSVLine(lines[0]);
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    // Skip footer/empty rows
    if (row.length === 0 || row.every(cell => cell.trim() === '')) continue;
    // Pad or trim to match header length
    while (row.length < headers.length) row.push('');
    rows.push(row.slice(0, headers.length));
  }

  return { headers, rows, fileName };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

const DATE_HEADERS = ['date', 'transaction date', 'posted date', 'post date'];
const DESC_HEADERS = ['description', 'payee', 'merchant', 'name'];
const AMOUNT_HEADERS = ['amount'];
const DEBIT_HEADERS = ['debit'];
const CREDIT_HEADERS = ['credit'];

export function autoDetectColumns(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const lower = headers.map(h => h.toLowerCase().trim());

  for (let i = 0; i < lower.length; i++) {
    if (!mapping.date && DATE_HEADERS.includes(lower[i])) {
      mapping.date = headers[i];
    }
    if (!mapping.description && DESC_HEADERS.includes(lower[i])) {
      mapping.description = headers[i];
    }
    if (!mapping.amount && AMOUNT_HEADERS.includes(lower[i])) {
      mapping.amount = headers[i];
    }
    if (!mapping.debit && DEBIT_HEADERS.includes(lower[i])) {
      mapping.debit = headers[i];
    }
    if (!mapping.credit && CREDIT_HEADERS.includes(lower[i])) {
      mapping.credit = headers[i];
    }
  }

  return mapping;
}

export function isValidMapping(mapping: Partial<ColumnMapping>): mapping is ColumnMapping {
  if (!mapping.date || !mapping.description) return false;
  if (!mapping.amount && !(mapping.debit && mapping.credit)) return false;
  return true;
}
