import { NextResponse } from 'next/server';
import { plaidClient, tokenStore } from '@/lib/plaid/client';
import { convertPlaidTransactions } from '@/lib/plaid/converter';
import type { Transaction as PlaidTransaction } from 'plaid';

export async function POST(request: Request) {
  try {
    const { cursor, institution_name } = await request.json();

    const accessToken = tokenStore.get('default');
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No linked account. Please connect your bank first.' },
        { status: 401 }
      );
    }

    let allAdded: PlaidTransaction[] = [];
    let nextCursor = cursor || '';
    let hasMore = true;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: nextCursor || undefined,
        options: {
          include_original_description: true,
        },
      });

      const data = response.data;
      allAdded = allAdded.concat(data.added);
      hasMore = data.has_more;
      nextCursor = data.next_cursor;
    }

    const transactions = convertPlaidTransactions(
      allAdded,
      institution_name || 'Plaid'
    );

    return NextResponse.json({ transactions, next_cursor: nextCursor });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch transactions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
