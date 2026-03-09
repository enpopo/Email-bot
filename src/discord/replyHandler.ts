/**
 * replyHandler.ts — Listen for operator replies to email notification posts.
 *
 * When the operator replies to a Discord message that corresponds to an email,
 * this handler extracts the operator's instruction text and dispatches to the
 * LLM handler to generate a draft reply.
 */

import type { Message } from 'discord.js';
import { discordClient } from './bot';
import { prisma } from '../db';

export type OnOperatorReplyCallback = (
  emailId: string,
  operatorReply: string,
  discordMessageId: string,
) => Promise<void>;

/**
 * Register the messageCreate listener.
 * Call once at startup after bot is logged in.
 */
export function registerReplyHandler(onOperatorReply: OnOperatorReplyCallback): void {
  discordClient.on('messageCreate', async (message: Message) => {
    // Ignore bots (including ourselves)
    if (message.author.bot) return;

    // Must be a reply to another message
    if (!message.reference?.messageId) return;

    const referencedMessageId = message.reference.messageId;

    // Look up the email by its Discord message ID
    const email = await prisma.email.findUnique({
      where: { discordMessageId: referencedMessageId },
    });

    if (!email) return; // Not a reply to one of our email notifications

    const operatorReply = message.content.trim();
    if (!operatorReply) return;

    console.log(
      `[discord] Operator reply for email ${email.id}: "${operatorReply.slice(0, 80)}..."`,
    );

    try {
      await onOperatorReply(email.id, operatorReply, referencedMessageId);
    } catch (err) {
      console.error('[discord] Error processing operator reply:', err);
      await message.reply('❌ Error generating draft. Please try again.');
    }
  });

  console.log('[discord] Reply handler registered');
}
