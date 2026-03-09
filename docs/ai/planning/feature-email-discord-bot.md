---
phase: planning
title: Project Planning & Task Breakdown
feature: email-discord-bot
---

# Project Planning & Task Breakdown — email-discord-bot

## Milestones

- [x] M1: Project scaffold + config (TypeScript, env, HTTP server)
- [x] M2: Database setup (Prisma + PostgreSQL schema + migrations)
- [x] M3: Gmail integration (OAuth2 + polling + parsing + sending)
- [x] M4: Discord integration (bot posts email + detects replies + approval buttons)
- [x] M5: LLM integration (abstract provider interface + OpenAI implementation + template)
- [x] M6: Approval workflow + end-to-end wiring
- [x] M7: Error handling, health check, polish

## Task Breakdown

### Phase 1: Foundation
- [x] T1.1: Initialize Bun + TypeScript project — `bun init`, `tsconfig.json`, `src/index.ts` entry point
- [x] T1.2: Create `src/config.ts` — load and validate all required env vars (including `DATABASE_URL`) with clear error messages
- [x] T1.3: Create `src/server/httpServer.ts` — `Bun.serve()` HTTP server with `/health` route
- [x] T1.4: Create `.env.example` documenting all required environment variables (including `DATABASE_URL`)

### Phase 2: Database Setup (Prisma + PostgreSQL)
- [x] T2.0: Install Prisma dependencies — `bun add -d prisma`, `bun add @prisma/client @prisma/adapter-pg pg`
- [x] T2.1: Create `prisma/schema.prisma` — datasource `postgresql`, generator with `output = "../generated/prisma"`, models: `PollingState`, `Email`, `Draft` (with `DraftStatus` enum); Note: Prisma v7 — no `url` in schema, connection set in `prisma/config.ts`
- [x] T2.2: Create `prisma/config.ts` — Prisma v7 config with `migrate.adapter` using `PrismaPg` and `DATABASE_URL`
- [x] T2.3: Run `bunx --bun prisma migrate dev --name init` — migration applied to `email_discord_bot` DB; generated client at `generated/prisma/client.ts`
- [x] T2.4: Create `src/db.ts` — instantiate `PrismaClient` with `PrismaPg` adapter; import from `../generated/prisma/client`

### Phase 3: Gmail Integration
- [x] T3.1: Create `src/gmail/auth.ts` — OAuth2 client with refresh token; `getGmailClient()`; `handleOAuthCallback()` for initial setup; `getAuthUrl()` helper
- [x] T3.2: Create `src/gmail/poller.ts` — `setInterval` polling; historyId-based incremental fetch; falls back to recent message list on 404; deduplicates via DB; saves to `Email` table
- [x] T3.3: Create `src/gmail/parser.ts` — extracts subject, from, replyTo, body (text/plain preferred, HTML stripped as fallback), threadId; handles multipart MIME
- [x] T3.4: Create `src/gmail/sender.ts` — builds RFC 2822 MIME with HTML body; base64url-encoded; sends via `users.messages.send` with threadId for threading

### Phase 4: Discord Integration
- [x] T4.1: Create `src/discord/bot.ts` — discord.js v14 client init with minimal intents (`Guilds`, `GuildMessages`, `MessageContent`), login, ready event; register `interactionCreate` handler for button clicks
- [x] T4.2: Create `src/discord/notifier.ts` — format email as Discord embed/message, mention fixed operator, post to channel; update `Email.discordMessageId` in DB
- [x] T4.3: Create `src/discord/replyHandler.ts` — `messageCreate` listener that checks `message.reference`, looks up `Email` by `discordMessageId` in DB, dispatches to LLM handler
- [x] T4.4: Create `src/discord/approvalHandler.ts` — `interactionCreate` listener for Approve button; on click: acknowledge immediately, look up `Draft` by `approvalMessageId` in DB, update status to `APPROVED`, trigger `GmailSender`, update status to `SENT` or `FAILED`, post confirmation or error

### Phase 5: LLM Integration (Abstract + OpenAI)
- [x] T5.0: Create `templates/email-reply.html` — HTML template file with placeholders for email context and operator instructions
- [x] T5.1: Create `src/llm/template.ts` — load HTML reply template from `templates/email-reply.html`, interpolate placeholders (`{{subject}}`, `{{from}}`, `{{body}}`, `{{userReply}}`)
- [x] T5.2: Create `src/llm/types.ts` — define `LLMProvider` interface with `generate(prompt: string): Promise<string>` method
- [x] T5.3: Create `src/llm/providers/openai.ts` — implement `LLMProvider` using OpenAI Chat Completions API (`openai` SDK)
- [x] T5.4: Create `src/llm/factory.ts` — provider factory that reads `LLM_PROVIDER` env var and returns the appropriate `LLMProvider` instance (default: `openai`)
- [x] T5.5: Create `src/llm/handler.ts` — build prompt from template + reply, delegate to `LLMProvider` instance from factory, return generated HTML email body

### Phase 6: Approval Workflow & Wiring
- [x] T6.1: Wire all modules in `src/index.ts` — start HTTP server, connect Prisma, login Discord bot, start Gmail poller
- [x] T6.2: On startup, load pending `Email` records (with `discordMessageId`) and pending `Draft` records from DB to rebuild in-memory lookup maps
- [x] T6.3: Connect Gmail poller → Discord notifier (on new emails, save to DB + post to Discord)
- [x] T6.4: Connect Discord reply handler → LLM handler → save Draft to DB → post draft email in Discord with Approve button + tag operator → update Draft with `approvalMessageId`
- [x] T6.5: Connect Approve button handler → update Draft status → Gmail sender → update Draft status → post confirmation in Discord
- [x] T6.6: Mark previous pending drafts as `SUPERSEDED` when operator creates a new draft for the same email

### Phase 7: Polish
- [x] T7.1: Add error handling — Gmail poll errors, Discord post errors, LLM timeout/errors, Gmail send errors (update Draft status to `FAILED` + post error in Discord)
- [x] T7.2: Add `/health` endpoint DB connectivity check (Prisma `$queryRaw` or `$connect` check)
- [x] T7.3: Add `.gitignore` (`generated/`, `.env`, `node_modules/`)
- [x] T7.4: Add `README.md` with setup instructions (Bun install, PostgreSQL setup, `DATABASE_URL`, `bunx --bun prisma migrate deploy`, OAuth setup with send scope, Discord Developer Portal intents, env vars, `bun run src/index.ts`)
- [x] T7.5: Create `scripts/deploy-commands.ts` — separate script to register slash commands (guild for dev, global for prod); not run on startup
- [x] T7.6: Update `postDraftForApproval` in `src/discord/notifier.ts` — strip HTML from draft, show short plain-text preview (≤ 300 chars) in embed description instead of raw HTML code block

## Dependencies

- T2.0–T2.4 must complete before T3.2 (DB needed for polling state)
- T3.1 must complete before T3.2 and T3.4 (OAuth needed before API calls)
- T3.2, T3.3 must complete before T6.3
- T3.4 must complete before T6.5 (sender needed for approval flow)
- T4.1 must complete before T4.2, T4.3, and T4.4
- T4.4 must complete before T6.5 (approval handler needed)
- T5.0–T5.5 must complete before T6.4
- T6.1–T6.6 must complete before T7.1

**External dependencies**:
- PostgreSQL database (local or hosted), accessible via `DATABASE_URL`
- Google Cloud project with Gmail API enabled + OAuth2 credentials with **send** scope (`gmail.send` or `gmail.compose`)
- Discord bot created in Discord Developer Portal with `MESSAGE_CONTENT` intent enabled
- OpenAI API key (`OPENAI_API_KEY`)

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| PostgreSQL setup complexity for local dev | Document in README; provide Docker Compose example for local Postgres |
| Prisma ORM v7 driver adapter breaking changes | Pin exact versions in `package.json`; follow Prisma v7 docs for `@prisma/adapter-pg` setup |
| Gmail OAuth2 setup complexity (consent screen, send scope) | Document step-by-step in README; test with `gmail.readonly` scope first, then add `gmail.send` |
| Accidental email sending | Approval button required; no email sent without explicit operator click; status tracked in DB |
| Discord `MESSAGE_CONTENT` privileged intent not enabled | Call it out in setup docs; enable in Dev Portal |
| Gmail API quota (250 quota units/user/second) | 30-min polling is well within quota; sending is infrequent |
| LLM latency / API errors | Wrap in try/catch; post error message in Discord so operator knows |
| Gmail send errors | Update Draft status to `FAILED` in DB; post error in Discord; operator can retry |
| DB connection lost at runtime | Prisma handles connection pooling; wrap DB calls in try/catch; `/health` endpoint checks DB connectivity |

## Resources Needed

- `prisma` (dev dependency — CLI, invoked via `bunx --bun prisma`)
- `@prisma/client`
- `@prisma/adapter-pg` (Prisma v7 driver adapter)
- `pg` (PostgreSQL driver)
- `googleapis` (Gmail API client — read + send)
- `discord.js` (v14)
- `openai` (OpenAI SDK)
- All packages installed via `bun add` / `bun add -d`
- PostgreSQL database (local Docker or hosted)
- Google Cloud Console access (Gmail API + OAuth2 credentials with send scope)
- Discord Developer Portal access (bot token + server invite)
- OpenAI API key (`OPENAI_API_KEY`)
