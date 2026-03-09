/**
 * index.ts — Entry point for the email-discord-bot.
 *
 * Startup sequence:
 *   1. Connect to PostgreSQL via Prisma
 *   2. Start HTTP server (health check + OAuth callback)
 *   3. Login Discord bot + register handlers
 *   4. Start Gmail poller → on new email, notify Discord
 *   5. On operator Discord reply → LLM draft → post for approval
 *   6. On Approve button click → send email via Gmail
 */

import { config } from './config';
import { prisma } from './db';
import { startHttpServer, registerOAuthCallback } from './server/httpServer';
import { loginDiscordBot } from './discord/bot';
import { registerReplyHandler } from './discord/replyHandler';
import { registerApprovalHandler } from './discord/approvalHandler';
import { registerCommandHandler } from './discord/commandHandler';
import { notifyEmailReceived, postDraftForApproval, postStatusMessage } from './discord/notifier';
import { startGmailPoller, stopGmailPoller } from './gmail/poller';
import { handleOAuthCallback } from './gmail/auth';
import { generateDraftReply } from './llm/handler';
import type { ParsedEmail } from './gmail/parser';

async function main() {
  console.log('[app] Starting email-discord-bot...');

  // 1. Verify DB connection
  await prisma.$connect();
  console.log('[app] Database connected');

  // 2. HTTP server
  registerOAuthCallback(handleOAuthCallback);
  startHttpServer(config.port);

  // 3. Discord bot
  await loginDiscordBot();
  registerApprovalHandler();
  registerCommandHandler();

  // 4 & 5. Wire reply handler: operator reply → LLM → post draft for approval
  registerReplyHandler(async (emailId, operatorReply, discordMessageId) => {
    const email = await prisma.email.findUnique({ where: { id: emailId } });
    if (!email) throw new Error(`Email ${emailId} not found in DB`);

    // Mark any pending drafts for this email as SUPERSEDED (T6.6)
    await prisma.draft.updateMany({
      where: { emailId, status: 'PENDING' },
      data: { status: 'SUPERSEDED' },
    });

    // Generate draft via LLM
    const generatedHtml = await generateDraftReply(
      { subject: email.subject, from: email.from, body: email.body },
      operatorReply,
    );

    // Persist draft
    const draft = await prisma.draft.create({
      data: { emailId, operatorReply, generatedHtml, status: 'PENDING' },
    });

    // Post to Discord for approval
    try {
      const approvalMessageId = await postDraftForApproval(
        draft.id,
        generatedHtml,
        discordMessageId,
      );
      await prisma.draft.update({
        where: { id: draft.id },
        data: { approvalMessageId },
      });
    } catch (err) {
      console.error('[app] Failed to post draft for approval:', err);
      await postStatusMessage(`❌ Failed to post draft for email \`${emailId}\`: ${String(err)}`);
    }
  });

  // 4. Gmail poller → notify Discord on new emails
  startGmailPoller(async (email: ParsedEmail) => {
    try {
      await notifyEmailReceived(email);
    } catch (err) {
      console.error(`[app] Failed to notify Discord for email ${email.gmailMessageId}:`, err);
    }
  });

  console.log('[app] email-discord-bot is running');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[app] Received ${signal} — shutting down...`);
    stopGmailPoller();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[app] Fatal startup error:', err);
  process.exit(1);
});
