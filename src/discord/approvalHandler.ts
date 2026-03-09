/**
 * approvalHandler.ts — Handle Approve button interactions.
 *
 * When the operator clicks the Approve button on a draft message:
 * 1. Acknowledge the interaction immediately (Discord requires < 3s)
 * 2. Look up the Draft by ID from the button's customId
 * 3. Look up associated Email for send metadata
 * 4. Update Draft status to APPROVED
 * 5. Send the email via Gmail
 * 6. Update Draft status to SENT or FAILED
 * 7. Post confirmation or error message in Discord
 */

import type { Interaction } from 'discord.js';
import { discordClient } from './bot';
import { prisma } from '../db';
import { sendEmail } from '../gmail/sender';
import { postStatusMessage } from './notifier';

/**
 * Register the interactionCreate listener for button approvals.
 * Call once at startup after bot is logged in.
 */
export function registerApprovalHandler(): void {
  discordClient.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('approve:')) return;

    const draftId = interaction.customId.slice('approve:'.length);

    // Acknowledge immediately — Discord requires a response within 3 seconds
    await interaction.deferReply({ ephemeral: true });

    try {
      const draft = await prisma.draft.findUnique({
        where: { id: draftId },
        include: { email: true },
      });

      if (!draft) {
        await interaction.editReply(`❌ Draft \`${draftId}\` not found.`);
        return;
      }

      if (draft.status !== 'PENDING') {
        await interaction.editReply(
          `⚠️ Draft is already in status \`${draft.status}\` — no action taken.`,
        );
        return;
      }

      // Mark as approved
      await prisma.draft.update({
        where: { id: draftId },
        data: { status: 'APPROVED' },
      });

      // Send the email
      const recipientEmail = draft.email.replyTo ?? draft.email.from;
      let sentMessageId: string;
      try {
        sentMessageId = await sendEmail({
          to: recipientEmail,
          subject: draft.email.subject,
          htmlBody: draft.generatedHtml,
          threadId: draft.email.gmailThreadId,
        });
      } catch (sendErr) {
        console.error(`[discord] Gmail send failed for draft ${draftId}:`, sendErr);
        await prisma.draft.update({
          where: { id: draftId },
          data: { status: 'FAILED' },
        });
        await interaction.editReply(`❌ Failed to send email: ${String(sendErr)}`);
        await postStatusMessage(
          `❌ Email send FAILED for draft \`${draftId}\` — check logs.`,
        );
        return;
      }

      // Update to SENT
      await prisma.draft.update({
        where: { id: draftId },
        data: { status: 'SENT', sentAt: new Date() },
      });

      await interaction.editReply(
        `✅ Email sent! Gmail message ID: \`${sentMessageId}\``,
      );

      await postStatusMessage(
        `✅ Email sent to **${recipientEmail}** — Gmail ID: \`${sentMessageId}\``,
      );

      console.log(`[discord] Draft ${draftId} approved and sent — Gmail ID: ${sentMessageId}`);
    } catch (err) {
      console.error(`[discord] Approval handler error for draft ${draftId}:`, err);
      await interaction.editReply(`❌ Unexpected error: ${String(err)}`).catch(() => {});
    }
  });

  console.log('[discord] Approval handler registered');
}
