/**
 * config.ts — load and validate all required environment variables.
 * Throws descriptive errors on startup if any required var is missing.
 */

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  // Database
  databaseUrl: required('DATABASE_URL'),

  // Gmail OAuth2
  googleClientId: required('GOOGLE_CLIENT_ID'),
  googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
  googleRefreshToken: required('GOOGLE_REFRESH_TOKEN'),
  googleRedirectUri: optional('GOOGLE_REDIRECT_URI', 'http://localhost:3000/oauth/callback'),

  // Discord
  discordBotToken: required('DISCORD_BOT_TOKEN'),
  discordChannelId: required('DISCORD_CHANNEL_ID'),
  discordOperatorUserId: required('DISCORD_OPERATOR_USER_ID'),
  discordGuildId: optional('DISCORD_GUILD_ID', ''),

  // LLM
  llmProvider: optional('LLM_PROVIDER', 'openai'),
  openaiApiKey: required('OPENAI_API_KEY'),
  openaiModel: optional('OPENAI_MODEL', 'gpt-4o'),

  // Server
  port: Number(optional('PORT', '3000')),
  pollIntervalMs: Number(optional('POLL_INTERVAL_MS', String(30 * 60 * 1000))),
} as const;

export type Config = typeof config;
