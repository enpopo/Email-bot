/**
 * notifier.ts — Post incoming emails to Discord.
 *
 * Formats an email as a Discord embed, mentions the operator,
 * posts to the configured channel, and updates Email.discordMessageId in DB.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { discordClient } from './bot';
import { prisma } from '../db';
import { config } from '../config';
import type { ParsedEmail } from '../gmail/parser';

const MAX_BODY_LENGTH = 1000;

/**
 * Post an email notification to Discord and update the DB with the message ID.
 * Returns the Discord message ID on success.
 */
export async function notifyEmailReceived(email: ParsedEmail): Promise<string> {
  const channel = await discordClient.channels.fetch(config.discordChannelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error(`[discord] Channel ${config.discordChannelId} not found or not a text channel`);
  }

  const truncatedBody =
    email.body.length > MAX_BODY_LENGTH
      ? `${email.body.slice(0, MAX_BODY_LENGTH)}…`
      : email.body;

  const embed = new EmbedBuilder()
    .setTitle(`📧 ${email.subject}`)
    .setDescription(truncatedBody || '*(empty body)*')
    .addFields(
      { name: 'From', value: email.from, inline: true },
      { name: 'Reply-To', value: email.replyTo ?? email.from, inline: true },
      { name: 'Received', value: email.receivedAt.toISOString(), inline: false },
    )
    .setColor(0x5865f2)
    .setFooter({ text: `Gmail ID: ${email.gmailMessageId}` })
    .setTimestamp();

  const message = await channel.send({
    content: `<@${config.discordOperatorUserId}> New email received — reply here with instructions to draft a response.`,
    embeds: [embed],
  });

  // Persist the Discord message ID so replies can be linked back to this email
  await prisma.email.update({
    where: { gmailMessageId: email.gmailMessageId },
    data: { discordMessageId: message.id },
  });

  console.log(`[discord] Posted email ${email.gmailMessageId} → message ${message.id}`);
  return message.id;
}

/**
 * Post the LLM-generated draft email in Discord with an Approve button.
 * Returns the Discord approval message ID.
 */
export async function postDraftForApproval(
  draftId: string,
  draftHtml: string,
  originalMessageId: string,
): Promise<string> {
  const channel = await discordClient.channels.fetch(config.discordChannelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error(`[discord] Channel ${config.discordChannelId} not found or not a text channel`);
  }

  const truncated =
    draftHtml.length > MAX_BODY_LENGTH
      ? `${draftHtml.slice(0, MAX_BODY_LENGTH)}…`
      : draftHtml;

  const embed = new EmbedBuilder()
    .setTitle('✉️ Draft Reply Ready for Approval')
    .setDescription(`\`\`\`html\n${truncated}\n\`\`\``)
    .setColor(0xfee75c)
    .setFooter({ text: `Draft ID: ${draftId}` })
    .setTimestamp();

  const approveButton = new ButtonBuilder()
    .setCustomId(`approve:${draftId}`)
    .setLabel('✅ Approve & Send')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton);

  const approvalMessage = await channel.send({
    content: `<@${config.discordOperatorUserId}> Draft ready — review and click Approve to send.`,
    embeds: [embed],
    components: [row],
    reply: { messageReference: originalMessageId, failIfNotExists: false },
  });

  console.log(`[discord] Draft ${draftId} posted for approval → message ${approvalMessage.id}`);
  return approvalMessage.id;
}

/**
 * Post a plain status message in the channel (for confirmations / errors).
 */
export async function postStatusMessage(content: string): Promise<void> {
  const channel = await discordClient.channels.fetch(config.discordChannelId);
  if (!channel || !(channel instanceof TextChannel)) return;
  await channel.send({ content });
}
