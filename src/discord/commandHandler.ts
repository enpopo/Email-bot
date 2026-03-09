/**
 * commandHandler.ts — Handle slash command interactions.
 *
 * /status  — pending email + draft counts
 * /pending — list emails with no operator reply yet
 * /drafts  — list drafts awaiting approval
 */

import { ChatInputCommandInteraction, EmbedBuilder, type Interaction } from 'discord.js';
import { discordClient } from './bot';
import { prisma } from '../db';

export function registerCommandHandler(): void {
  discordClient.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
      case 'status':
        await handleStatus(interaction);
        break;
      case 'pending':
        await handlePending(interaction);
        break;
      case 'drafts':
        await handleDrafts(interaction);
        break;
    }
  });

  console.log('[discord] Command handler registered');
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const [emailsWithoutReply, pendingDrafts, sentToday] = await Promise.all([
    prisma.email.count({ where: { drafts: { none: {} } } }),
    prisma.draft.count({ where: { status: 'PENDING' } }),
    prisma.draft.count({
      where: {
        status: 'SENT',
        sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const embed = new EmbedBuilder()
    .setTitle('📊 Bot Status')
    .addFields(
      { name: 'Emails awaiting reply', value: String(emailsWithoutReply), inline: true },
      { name: 'Drafts pending approval', value: String(pendingDrafts), inline: true },
      { name: 'Emails sent (last 24h)', value: String(sentToday), inline: true },
    )
    .setColor(0x5865f2)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handlePending(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const emails = await prisma.email.findMany({
    where: { drafts: { none: {} } },
    orderBy: { receivedAt: 'desc' },
    take: 10,
  });

  if (emails.length === 0) {
    await interaction.editReply('✅ No emails waiting for a reply.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📬 ${emails.length} Email(s) Awaiting Reply`)
    .setColor(0xfee75c)
    .setDescription(
      emails
        .map(
          (e, i) =>
            `**${i + 1}.** ${e.subject}\n` +
            `> From: ${e.from}\n` +
            `> Received: ${e.receivedAt.toISOString()}\n` +
            (e.discordMessageId ? `> Discord msg: \`${e.discordMessageId}\`` : ''),
        )
        .join('\n\n'),
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleDrafts(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const drafts = await prisma.draft.findMany({
    where: { status: 'PENDING' },
    include: { email: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (drafts.length === 0) {
    await interaction.editReply('✅ No drafts pending approval.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`✉️ ${drafts.length} Draft(s) Pending Approval`)
    .setColor(0xed4245)
    .setDescription(
      drafts
        .map(
          (d, i) =>
            `**${i + 1}.** Re: ${d.email.subject}\n` +
            `> To: ${d.email.replyTo ?? d.email.from}\n` +
            `> Draft ID: \`${d.id}\`\n` +
            `> Created: ${d.createdAt.toISOString()}`,
        )
        .join('\n\n'),
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
