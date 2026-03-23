import { NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid/client';
import { Products, CountryCode } from 'plaid';

export async function POST() {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: 'local-user',
        phone_number: '+14155550123',
      },
      client_name: 'Credit Card Ralph',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create link token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
