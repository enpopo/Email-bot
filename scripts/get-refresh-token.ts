/**
 * get-refresh-token.ts — Standalone OAuth2 helper to obtain a Gmail refresh token.
 *
 * Run with: bun run scripts/get-refresh-token.ts
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI  (default: http://localhost:3000/oauth/callback)
 */

import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/oauth/callback';

if (!CLIENT_ID) throw new Error('Missing GOOGLE_CLIENT_ID');
if (!CLIENT_SECRET) throw new Error('Missing GOOGLE_CLIENT_SECRET');

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
  ],
});

console.log('\n=== Gmail OAuth2 Setup ===');
console.log('Starting HTTP server on http://localhost:3000');
console.log('\nAuth URL:\n' + authUrl + '\n');

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/oauth/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing code parameter', { status: 400 });
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);

        console.log('\n✅ Tokens received!');
        console.log(JSON.stringify(tokens, null, 2));

        if (tokens.refresh_token) {
          console.log('\n🔑 Copy this to your .env as GOOGLE_REFRESH_TOKEN:');
          console.log(tokens.refresh_token);
        } else {
          console.log('\n⚠️  No refresh_token returned.');
          console.log('This happens when the Google account was already authorized.');
          console.log('Go to https://myaccount.google.com/permissions and revoke access,');
          console.log('then run this script again.');
        }

        process.exit(0);
      } catch (err) {
        console.error('Error exchanging code:', err);
        return new Response('Error exchanging code', { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
});
