/**
 * parser.ts — Extract structured fields from a Gmail API message payload.
 *
 * Handles multipart MIME messages and base64url-encoded bodies.
 */

import type { gmail_v1 } from 'googleapis';

export interface ParsedEmail {
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string;
  from: string;
  replyTo: string | null;
  body: string;
  receivedAt: Date;
}

/**
 * Parse a full Gmail message resource into a structured ParsedEmail.
 */
export function parseGmailMessage(message: gmail_v1.Schema$Message): ParsedEmail {
  const id = message.id ?? '';
  const threadId = message.threadId ?? '';
  const payload = message.payload ?? {};
  const headers = payload.headers ?? [];

  const getHeader = (name: string): string =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

  const subject = getHeader('Subject') || '(no subject)';
  const from = getHeader('From');
  const replyToRaw = getHeader('Reply-To');
  const replyTo = replyToRaw || null;

  // internalDate is milliseconds since epoch as a string
  const receivedAt = message.internalDate
    ? new Date(Number(message.internalDate))
    : new Date();

  const body = extractPlainText(payload);

  return { gmailMessageId: id, gmailThreadId: threadId, subject, from, replyTo, body, receivedAt };
}

/**
 * Recursively extract plain text from a MIME message part.
 * Prefers text/plain; falls back to stripping HTML tags from text/html.
 */
function extractPlainText(part: gmail_v1.Schema$MessagePart): string {
  const mimeType = part.mimeType ?? '';

  // Leaf node with body data
  if (part.body?.data) {
    const decoded = base64urlDecode(part.body.data);
    if (mimeType === 'text/plain') return decoded.trim();
    if (mimeType === 'text/html') return stripHtml(decoded).trim();
  }

  // Recurse into parts
  if (part.parts && part.parts.length > 0) {
    // Prefer text/plain part
    const plainPart = part.parts.find((p) => p.mimeType === 'text/plain');
    if (plainPart) {
      const text = extractPlainText(plainPart);
      if (text) return text;
    }
    // Fallback: first part that yields text
    for (const child of part.parts) {
      const text = extractPlainText(child);
      if (text) return text;
    }
  }

  return '';
}

function base64urlDecode(data: string): string {
  // Gmail uses base64url encoding (RFC 4648)
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
