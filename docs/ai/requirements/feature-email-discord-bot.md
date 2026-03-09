---
phase: requirements
title: Requirements & Problem Understanding
feature: email-discord-bot
---

# Requirements & Problem Understanding — email-discord-bot

## Problem Statement

Incoming emails to Gmail need human attention but there is no efficient notification or response workflow. Manually checking Gmail, crafting replies, and sending them is slow. The goal is to surface incoming emails in Discord, let the operator provide reply instructions, have an LLM draft a professional HTML email, and send it back to the client — all from within Discord, with an explicit approval step before sending.

**Who is affected**: A single operator who wants to triage and reply to client emails from within Discord without switching to Gmail.

**Current workaround**: Manually checking Gmail, writing replies, and sending them by hand.

## Goals & Objectives

**Primary goals**:
- Poll Gmail every 30 minutes and forward new client emails to a Discord channel
- Mention a fixed Discord user so they are notified immediately
- When the operator replies to the bot's email post (via Discord reply), the backend combines the operator's instructions + original email context + an HTML template and sends it to an LLM to generate a ready-to-send email
- Post the LLM-generated email content back to Discord for review, with an **Approve** button and the operator tagged
- When the operator clicks **Approve**, the backend sends the email to the client via Gmail
- Persist all email data, drafts, and approval state in PostgreSQL via Prisma ORM

**Non-goals**:
- Multi-user routing or dynamic mention logic
- Mobile push notifications
- Editing the draft in Discord before approval (operator can reject and reply again to regenerate)

## User Stories & Use Cases

- As the operator, I want to see new Gmail messages appear in a Discord channel so I don't need to check Gmail manually.
- As the operator, I want the bot to mention me so I get a Discord notification for each new email.
- As the operator, I want to reply to the bot's email post with my instructions (e.g., "tell them we'll deliver next week") and have the bot generate a professional HTML email draft.
- As the operator, I want to review the generated email in Discord before it is sent.
- As the operator, I want to click an **Approve** button to send the email, so nothing is sent without my explicit confirmation.
- As the operator, I want the polling to happen automatically every 30 minutes without any manual trigger.
- As the operator, I want all email history and draft approvals persisted so I can recover state after a restart.

**Edge cases**:
- Email received while bot is restarting → picked up on next poll cycle (no email is permanently missed as long as last-seen historyId is persisted in DB)
- Multiple new emails arrive between polls → each forwarded as a separate Discord message
- Discord user does not reply → no LLM call made; no email sent; no side effects
- LLM API is unavailable → bot replies with an error message in Discord; no email sent
- Operator does not click Approve → email is never sent; draft stays in DB with `pending` status
- Operator wants to re-draft → replies again to the original email post; new draft created in DB, previous draft marked `superseded`
- Service restarts → all pending emails and unapproved drafts recovered from PostgreSQL

## Success Criteria

- New Gmail emails appear in the Discord channel within 30 minutes of arrival
- The configured Discord user is mentioned in every forwarded email post
- When the Discord user replies to a bot message, the bot posts an LLM-generated email draft (HTML-formatted) within 10 seconds
- The draft message includes an **Approve** button and tags the operator
- Clicking **Approve** sends the email via Gmail to the original sender within 5 seconds
- No email is ever sent without the operator clicking Approve
- All email records, drafts, and approval events are persisted in PostgreSQL
- The service recovers pending state from the database after a restart
- The service runs continuously as a long-lived Bun process

## Constraints & Assumptions

**Technical constraints**:
- TypeScript project running on **Bun** runtime; uses Bun's built-in HTTP server (`Bun.serve()`), native TypeScript execution (no build step), and `bun` as package manager
- Gmail access via Gmail API (OAuth2) for both reading and sending emails
- Discord integration via discord.js v14 bot, following best practices:
  - Use minimal required gateway intents: `Guilds`, `GuildMessages`, `MessageContent` (privileged — required to read reply content)
  - `MessageContent` privileged intent must be enabled in the Discord Developer Portal
  - Use Discord interactive components (Buttons) for the approval workflow
  - Do not sync/register slash commands on every startup — use a separate deploy script
  - Never block the event loop; use async/await for all I/O (Gmail polling, LLM calls, email sending, DB queries)
  - Never hardcode tokens; all secrets via environment variables
  - Use guild commands during development (instant propagation) vs global commands in production
- LLM module abstracted behind a provider interface (`LLMProvider`) to allow swapping models (OpenAI, Anthropic, etc.)
  - Current implementation: **OpenAI** (`openai` SDK)
  - Provider selected via `LLM_PROVIDER` env var (default: `openai`)
  - New providers added by implementing the `LLMProvider` interface without changing business logic
- LLM reply template stored as an HTML template file (e.g., `templates/email-reply.html`) with placeholders for email context and operator instructions
- **Database**: PostgreSQL via Prisma ORM v7 with driver adapter (`@prisma/adapter-pg` + `pg`)
  - Prisma schema at `prisma/schema.prisma` with `output = "../generated"` for generated client
  - Prisma config at `prisma.config.ts` for connection URL
  - All state persisted in DB: emails, drafts, approvals, polling state
  - Prisma CLI invoked with `bunx --bun prisma ...` to use Bun runtime instead of Node.js
  - Migrations managed via `bunx --bun prisma migrate dev` / `bunx --bun prisma migrate deploy`
- All secrets (`DATABASE_URL`, Gmail OAuth tokens, Discord bot token, Discord channel/user IDs, `OPENAI_API_KEY`) stored in environment variables

**Assumptions**:
- Gmail OAuth2 credentials are already created in Google Cloud Console with **send** scope (`gmail.send` or `gmail.compose`) in addition to read scope
- The Discord bot is already added to the server with correct OAuth2 scopes (`bot`, `applications.commands`) and permissions (Send Messages, Read Message History, Embed Links, Use External Emojis)
- The `MessageContent` privileged intent is enabled in the Discord Developer Portal for the bot application
- Only one Gmail inbox is monitored
- The fixed Discord user ID is known and set via env var
- A PostgreSQL database is available and accessible via `DATABASE_URL` env var (local dev or hosted)
- Bun 1.x+ as runtime and package manager; TypeScript 5.4.0+ (Prisma ORM v7 requirements)

## Questions & Open Items

- ~~What LLM reply template should the bot use?~~ **Resolved**: An HTML template file (e.g., `templates/email-reply.html`) with placeholders for email subject, sender, body, and operator instructions.
- ~~Should the bot track which Discord messages are "replies to email posts" using Discord thread replies, or any message in the channel mentioning the bot?~~ **Resolved**: The bot tracks replies using Discord's built-in reply feature (message reference).
- ~~Should processed email IDs be stored per-session (in memory) or persisted across restarts (file)?~~ **Resolved**: Persisted in PostgreSQL via Prisma ORM. Replaces the previous `state.json` approach.
- ~~Is outbound email in scope?~~ **Resolved**: Yes. After LLM generates the email draft and operator clicks Approve, the backend sends the email via Gmail API.
- ~~Should a database be used?~~ **Resolved**: Yes. PostgreSQL with Prisma ORM v7 for all persistence — emails, drafts, approvals, and polling state.
