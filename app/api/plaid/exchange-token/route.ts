import { NextResponse } from 'next/server';
import { plaidClient, tokenStore } from '@/lib/plaid/client';

export async function POST(request: Request) {
  try {
    const { public_token } = await request.json();

    if (!public_token) {
      return NextResponse.json({ error: 'Missing public_token' }, { status: 400 });
    }

    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = response.data;

    tokenStore.set('default', access_token);

    return NextResponse.json({ success: true, item_id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to exchange token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
