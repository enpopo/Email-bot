---
phase: implementation
title: Implementation Notes
feature: email-discord-bot
---

# Implementation Notes — email-discord-bot

> Populated during Phase 4 (Execute Plan). Record decisions, deviations from design, and notable implementation details here.

## Key Implementation Details

### Full Flow

1. Gmail poller detects new email → saves `Email` record to PostgreSQL → posts to Discord with operator mention → updates `Email.discordMessageId`
2. Operator replies to bot's email post with instructions (e.g., "tell them we'll deliver next week")
3. Backend: looks up `Email` by `discordMessageId` in DB → operator reply + email context + HTML template → LLM generates HTML email draft
4. Bot saves `Draft` record (status: `PENDING`) → posts draft preview to Discord with **Approve** button + tags operator → updates `Draft.approvalMessageId`
5. Operator clicks **Approve** → bot updates `Draft` status to `APPROVED` → sends email via Gmail API → updates status to `SENT`
6. Bot posts send confirmation in Discord

### Bun Runtime

- **No build step**: Bun runs TypeScript natively — `bun run src/index.ts`
- **Package manager**: `bun add` / `bun add -d` (produces `bun.lockb`)
- **HTTP server**: `Bun.serve()` for `/health` and `/oauth/callback` routes
- **Test runner**: `bun test` (built-in, Jest-compatible API)

### Prisma ORM v7 + PostgreSQL (Bun)

- **Important**: All Prisma CLI commands use `bunx --bun prisma ...` so Prisma runs on Bun runtime instead of Node.js
- **Config file**: `prisma.config.ts` at **project root** (not inside `prisma/`); uses `defineConfig` + `env` from `prisma/config`
- **Datasource URL**: set via `datasource.url` in `prisma.config.ts` — NOT in `schema.prisma` (Prisma v7 removed `url` from datasource block)
- **Driver adapter pattern**: `PrismaPg` adapter from `@prisma/adapter-pg` wrapping `pg` driver
- **Client instantiation** (`src/db.ts`):
  ```typescript
  import { PrismaClient } from '../generated/prisma/client'
  import { PrismaPg } from '@prisma/adapter-pg'
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  export const prisma = new PrismaClient({ adapter })
  ```
- **Schema location**: `prisma/schema.prisma` with `output = "../generated/prisma"`
- **Generated client entry**: `generated/prisma/client.ts` (no index.ts — import directly from `/client`)
- **Migrations**: `bunx --bun prisma migrate dev` for development, `bunx --bun prisma migrate deploy` for production
- **Re-generate client**: `bunx --bun prisma generate` after every schema change
- Models: `PollingState` (singleton for historyId), `Email` (received emails), `Draft` (LLM-generated replies with status tracking)

### Discord.js v14 Best Practices

- Client created with minimal intents: `Guilds`, `GuildMessages`, `MessageContent`
- `MessageContent` is a privileged intent — must be enabled in Discord Developer Portal
- Slash commands registered via separate `scripts/deploy-commands.ts` (not on every startup)
- All event handlers use async/await; no blocking operations in the event loop
- Reply detection uses `message.reference.messageId` to match bot's email posts
- Approve button uses `ButtonBuilder` with `ButtonStyle.Success` + `interactionCreate` handler
- Button interaction acknowledged immediately (`interaction.deferUpdate()`) before processing

### LLM Abstraction

- **Provider interface** (`src/llm/types.ts`): `LLMProvider` with `generate(prompt: string): Promise<string>`
- **Factory** (`src/llm/factory.ts`): reads `LLM_PROVIDER` env var, returns concrete provider instance
- **Current provider**: `OpenAIProvider` (`src/llm/providers/openai.ts`) using `openai` SDK Chat Completions API
- **Adding a new provider**: implement `LLMProvider` interface, register in factory — no changes to handler or business logic
- **Handler** (`src/llm/handler.ts`): builds prompt from template + email context, delegates to `LLMProvider.generate()`, returns HTML email body

### HTML Template

- LLM reply template stored at `templates/email-reply.html`
- Placeholders: `{{subject}}`, `{{from}}`, `{{body}}`, `{{userReply}}`
- Template loaded once at startup via `src/llm/template.ts`
- Interpolated at runtime per reply, then passed to `LLMProvider.generate()`

### Gmail Sending

- Outbound emails sent via `gmail.users.messages.send`
- MIME message constructed with HTML body (RFC 2822 format)
- `threadId` included to thread the reply with the original email conversation
- `In-Reply-To` and `References` headers set for proper email threading

### Startup Recovery

- On startup, query DB for `Email` records with `discordMessageId` set → rebuild in-memory Discord message → Email lookup map
- Query DB for `Draft` records with status `PENDING` and `approvalMessageId` set → rebuild in-memory approval lookup map
- This ensures the bot can handle replies and approve buttons for messages posted before a restart
