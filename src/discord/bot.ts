/**
 * bot.ts — Discord.js v14 client initialization.
 *
 * Creates a singleton Client with minimal required intents.
 * Registers the interactionCreate handler for button clicks.
 * Export `loginDiscordBot()` to start the bot.
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../config';

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged — must be enabled in Dev Portal
  ],
});

discordClient.once('ready', (client) => {
  console.log(`[discord] Bot ready — logged in as ${client.user.tag}`);
});

/**
 * Login to Discord using the bot token from config.
 * Must be called once at startup before using any Discord functionality.
 */
export async function loginDiscordBot(): Promise<void> {
  await discordClient.login(config.discordBotToken);
}
