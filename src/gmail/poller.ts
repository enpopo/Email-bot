/**
 * poller.ts — Gmail polling loop.
 *
 * Polls Gmail every POLL_INTERVAL_MS using the historyId-based incremental API.
 * On first run (no saved historyId), falls back to listing recent messages.
 * Saves new emails to the Email table and fires onNewEmail for each one.
 */

import { getGmailClient } from './auth';
import { parseGmailMessage, type ParsedEmail } from './parser';
import { prisma } from '../db';
import { config } from '../config';

export type OnNewEmailCallback = (email: ParsedEmail) => Promise<void>;

let pollingTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the Gmail polling loop.
 * @param onNewEmail Called for each new email that has not been seen before.
 */
export function startGmailPoller(onNewEmail: OnNewEmailCallback): void {
  console.log('[gmail] Starting poller — interval:', config.pollIntervalMs, 'ms');

  // Run immediately, then on interval
  void pollOnce(onNewEmail);
  pollingTimer = setInterval(() => void pollOnce(onNewEmail), config.pollIntervalMs);
}

export function stopGmailPoller(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

async function pollOnce(onNewEmail: OnNewEmailCallback): Promise<void> {
  try {
    console.log('[gmail] Polling for new messages...');
    const gmail = getGmailClient();

    // Load persisted historyId
    const state = await prisma.pollingState.findUnique({ where: { id: 'singleton' } });
    const lastHistoryId = state?.lastHistoryId ?? null;

    let newMessages: Array<{ id: string }> = [];
    let newHistoryId: string | null = null;

    if (lastHistoryId) {
      // Incremental fetch via history API
      try {
        const historyRes = await gmail.users.history.list({
          userId: 'me',
          startHistoryId: lastHistoryId,
          historyTypes: ['messageAdded'],
          labelId: 'INBOX',
        });

        newHistoryId = historyRes.data.historyId ?? lastHistoryId;
        const history = historyRes.data.history ?? [];
        for (const record of history) {
          for (const added of record.messagesAdded ?? []) {
            if (added.message?.id) newMessages.push({ id: added.message.id });
          }
        }
      } catch (err: unknown) {
        // historyId expired → fall back to full list
        if (isGmailError(err, 404)) {
          console.warn('[gmail] historyId expired, falling back to recent message scan');
          newMessages = await listRecentMessages(gmail);
          newHistoryId = null;
        } else {
          throw err;
        }
      }
    } else {
      // First run — scan recent messages to establish baseline
      newMessages = await listRecentMessages(gmail);
    }

    console.log(`[gmail] Found ${newMessages.length} candidate message(s)`);

    let processedCount = 0;
    for (const { id } of newMessages) {
      // Skip already-processed messages
      const exists = await prisma.email.findUnique({ where: { gmailMessageId: id } });
      if (exists) continue;

      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });

      const parsed = parseGmailMessage(msgRes.data);

      // Save to DB
      await prisma.email.create({
        data: {
          gmailMessageId: parsed.gmailMessageId,
          gmailThreadId: parsed.gmailThreadId,
          from: parsed.from,
          replyTo: parsed.replyTo,
          subject: parsed.subject,
          body: parsed.body,
          receivedAt: parsed.receivedAt,
        },
      });

      await onNewEmail(parsed);
      processedCount++;
    }

    // Persist updated historyId
    if (newHistoryId || !lastHistoryId) {
      // Get the current historyId from the profile if we didn't get one from history
      const finalHistoryId = newHistoryId ?? await getCurrentHistoryId(gmail);
      if (finalHistoryId) {
        await prisma.pollingState.upsert({
          where: { id: 'singleton' },
          update: { lastHistoryId: finalHistoryId },
          create: { id: 'singleton', lastHistoryId: finalHistoryId },
        });
      }
    }

    console.log(`[gmail] Poll complete — ${processedCount} new email(s) processed`);
  } catch (err) {
    console.error('[gmail] Poll error:', err);
  }
}

async function listRecentMessages(gmail: ReturnType<typeof getGmailClient>): Promise<Array<{ id: string }>> {
  const res = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults: 20,
  });
  return (res.data.messages ?? []).filter((m): m is { id: string } => Boolean(m.id));
}

async function getCurrentHistoryId(gmail: ReturnType<typeof getGmailClient>): Promise<string | null> {
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return profile.data.historyId ?? null;
}

function isGmailError(err: unknown, statusCode: number): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === statusCode
  );
}
