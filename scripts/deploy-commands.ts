/**
 * deploy-commands.ts — Register Discord slash commands.
 *
 * Run with: bun run scripts/deploy-commands.ts
 *
 * Uses guild deployment (DISCORD_GUILD_ID) for dev (instant propagation).
 * Omit DISCORD_GUILD_ID for global deployment (can take up to 1 hour).
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN   — bot token
 *   DISCORD_CLIENT_ID   — application (client) ID from Dev Portal
 *   DISCORD_GUILD_ID    — (optional) guild ID for instant dev deployment
 */

import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN) throw new Error('Missing DISCORD_BOT_TOKEN');
if (!CLIENT_ID) throw new Error('Missing DISCORD_CLIENT_ID');

const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show a summary of pending emails and drafts'),

  new SlashCommandBuilder()
    .setName('pending')
    .setDescription('List emails that have not yet received an operator reply'),

  new SlashCommandBuilder()
    .setName('drafts')
    .setDescription('List drafts currently waiting for approval'),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function deploy() {
  console.log('[deploy] Registering slash commands...');

  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID!);

  await rest.put(route, { body: commands });

  const scope = GUILD_ID ? `guild ${GUILD_ID}` : 'global';
  console.log(`[deploy] ${commands.length} command(s) registered (${scope}):`);
  for (const cmd of commands) {
    console.log(`  /${(cmd as { name: string }).name}`);
  }
}

deploy().catch((err) => {
  console.error('[deploy] Error:', err);
  process.exit(1);
});
