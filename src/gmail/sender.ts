/**
 * sender.ts — Send an HTML email reply via Gmail API.
 *
 * Constructs an RFC 2822 MIME message, base64url-encodes it,
 * and sends via users.messages.send, threading via threadId.
 */

import { getGmailClient } from './auth';

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  threadId: string;
  inReplyToMessageId?: string; // Gmail Message-ID header of the original email
}

/**
 * Send a reply email and return the sent message ID.
 */
export async function sendEmail(options: SendEmailOptions): Promise<string> {
  const { to, subject, htmlBody, threadId, inReplyToMessageId } = options;

  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

  const headers: Record<string, string> = {
    To: to,
    Subject: encodeMimeHeader(replySubject),
    'MIME-Version': '1.0',
    'Content-Type': 'text/html; charset=UTF-8',
  };

  if (inReplyToMessageId) {
    headers['In-Reply-To'] = inReplyToMessageId;
    headers['References'] = inReplyToMessageId;
  }

  const rawMessage = buildRawMessage(headers, htmlBody);

  const gmail = getGmailClient();
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: rawMessage,
      threadId,
    },
  });

  const sentId = res.data.id;
  if (!sentId) throw new Error('Gmail send succeeded but returned no message ID');

  console.log(`[gmail] Email sent — id: ${sentId}, thread: ${threadId}`);
  return sentId;
}

/**
 * Encode a header value that may contain non-ASCII characters using RFC 2047
 * encoded-words (Base64, UTF-8). Pure ASCII values are returned as-is.
 */
function encodeMimeHeader(value: string): string {
  if (!/[^\x00-\x7F]/.test(value)) return value;
  const b64 = Buffer.from(value, 'utf-8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

function buildRawMessage(headers: Record<string, string>, body: string): string {
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\r\n');

  const raw = `${headerLines}\r\n\r\n${body}`;

  // Gmail requires base64url encoding (RFC 4648)
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
