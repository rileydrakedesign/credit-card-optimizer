import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const envMap: Record<string, string> = {
  sandbox: PlaidEnvironments.sandbox,
  development: PlaidEnvironments.development,
  production: PlaidEnvironments.production,
};

const configuration = new Configuration({
  basePath: envMap[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

// Persist access token to a temp file so it survives HMR/Fast Refresh.
// Stored in /tmp to avoid triggering Next.js file watcher (writing inside
// .next/ causes Fast Refresh rebuilds that wipe client state mid-flow).
const TOKEN_FILE = join('/tmp', 'plaid-tokens.json');

function readTokens(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeTokens(tokens: Record<string, string>) {
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens));
}

export const tokenStore = {
  get(key: string): string | undefined {
    return readTokens()[key];
  },
  set(key: string, value: string) {
    const tokens = readTokens();
    tokens[key] = value;
    writeTokens(tokens);
  },
};
