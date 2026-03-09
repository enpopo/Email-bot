/**
 * httpServer.ts — Bun.serve() HTTP server.
 * Routes:
 *   GET /health        — liveness check (DB connectivity added in T7.2)
 *   GET /oauth/callback — Gmail OAuth2 authorization code exchange
 */

import { prisma } from '../db';

type OAuthCallbackHandler = (code: string) => Promise<void>;

let oauthCallbackHandler: OAuthCallbackHandler | null = null;

export function registerOAuthCallback(handler: OAuthCallbackHandler): void {
  oauthCallbackHandler = handler;
}

export function startHttpServer(port: number): void {
  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/health') {
        try {
          await prisma.$queryRaw`SELECT 1`;
          return new Response(JSON.stringify({ status: 'ok', db: 'connected' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch {
          return new Response(JSON.stringify({ status: 'error', db: 'disconnected' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      if (url.pathname === '/oauth/callback') {
        const code = url.searchParams.get('code');
        if (!code) {
          return new Response('Missing code parameter', { status: 400 });
        }
        if (!oauthCallbackHandler) {
          return new Response('OAuth callback not registered', { status: 503 });
        }
        try {
          await oauthCallbackHandler(code);
          return new Response('OAuth success. You may close this window.');
        } catch (err) {
          console.error('[http] OAuth callback error:', err);
          return new Response('OAuth error', { status: 500 });
        }
      }

      return new Response('Not found', { status: 404 });
    },
  });

  console.log(`[http] Server listening on http://localhost:${port}`);
}
