/**
 * auth.ts — Gmail OAuth2 client setup and token management.
 *
 * Uses pre-obtained refresh token from env vars.
 * The /oauth/callback route handler is exported for registration with the HTTP server.
 */

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { config } from '../config';

let _client: OAuth2Client | null = null;

/**
 * Returns a singleton OAuth2 client with credentials already set.
 * The access token is refreshed automatically by the google-auth-library.
 */
export function getOAuthClient(): OAuth2Client {
  if (_client) return _client;

  const client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );

  client.setCredentials({
    refresh_token: config.googleRefreshToken,
  });

  _client = client;
  return _client;
}

/**
 * Returns an authenticated Gmail API client.
 */
export function getGmailClient() {
  return google.gmail({ version: 'v1', auth: getOAuthClient() });
}

/**
 * Handles the /oauth/callback route — exchanges authorization code for tokens.
 * Useful during initial setup to obtain a refresh token.
 * Logs the refresh token to stdout so the operator can copy it to .env.
 */
export async function handleOAuthCallback(code: string): Promise<void> {
  const client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
  const { tokens } = await client.getToken(code);
  console.log('[oauth] Tokens received:');
  console.log(JSON.stringify(tokens, null, 2));
  if (tokens.refresh_token) {
    console.log('\n[oauth] Copy this refresh token to your .env as GOOGLE_REFRESH_TOKEN:');
    console.log(tokens.refresh_token);
  } else {
    console.log('[oauth] No refresh token returned — ensure access_type=offline and prompt=consent in the auth URL.');
  }
}

/**
 * Generates the authorization URL for initial OAuth2 setup.
 * Open this URL in a browser to obtain an authorization code.
 */
export function getAuthUrl(): string {
  const client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ],
  });
}
