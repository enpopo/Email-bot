---
phase: testing
title: Testing Plan
feature: email-discord-bot
---

# Testing Plan — email-discord-bot

> Populated during Phase 7 (Write Tests). Record test coverage, test cases, and results here.

## Test Strategy

Unit tests for pure logic modules; integration tests for wired flows with mocked external APIs and a real test database. All tests run via `bun test` (Bun's built-in test runner, Jest-compatible API).

## Unit Test Cases

### `src/gmail/parser.ts`
- Parses subject, from, body, threadId from Gmail message payload
- Handles multipart MIME messages (text/plain extraction)
- Handles missing subject/from gracefully
- Extracts Reply-To address when present, falls back to From

### `src/gmail/sender.ts`
- Constructs valid RFC 2822 MIME message with HTML body
- Sets correct headers: To, Subject, In-Reply-To, References, Content-Type
- Includes threadId for Gmail threading
- Base64url encodes the raw message correctly

### `src/llm/types.ts` + `src/llm/factory.ts`
- `LLMProvider` interface defines `generate(prompt): Promise<string>`
- Factory returns `OpenAIProvider` when `LLM_PROVIDER=openai` (or unset)
- Factory throws clear error for unknown provider name

### `src/llm/providers/openai.ts`
- Calls OpenAI Chat Completions API with correct model and prompt
- Returns generated text content
- Throws on API errors with descriptive message

### `src/llm/template.ts`
- Loads HTML template file from `templates/email-reply.html`
- Interpolates all placeholders (`{{subject}}`, `{{from}}`, `{{body}}`, `{{userReply}}`)
- Throws clear error if template file is missing

### `src/config.ts`
- Validates all required env vars are present (including `DATABASE_URL`)
- Throws descriptive errors for missing vars

### `src/discord/replyHandler.ts`
- Detects reply to bot message via `message.reference`
- Ignores messages without reference
- Ignores replies to non-bot messages
- Looks up Email by `discordMessageId` in DB
- Dispatches to LLM handler with correct email context

### `src/discord/approvalHandler.ts`
- Detects Approve button click via `interactionCreate`
- Ignores interactions from non-operator users
- Acknowledges interaction immediately
- Looks up Draft by `approvalMessageId` in DB
- Updates Draft status to `APPROVED` → `SENT` on success, `FAILED` on error
- Disables button after approval (prevents double-send)

## Database Test Cases

### `src/db.ts` + Prisma models
- Creates and reads `PollingState` singleton record
- Creates `Email` record with all fields
- Creates `Draft` linked to `Email`
- Updates `Draft.status` through lifecycle (`PENDING` → `APPROVED` → `SENT`)
- Marks old drafts as `SUPERSEDED` when new draft created for same email
- Queries pending drafts and emails for startup recovery

## Integration Test Cases

### Gmail Poller → DB → Discord Notifier
- New emails saved to `Email` table and posted as Discord messages with operator mention
- Duplicate emails (already in DB by `gmailMessageId`) are skipped
- `Email.discordMessageId` updated after Discord post
- Gmail API errors are caught and logged (no crash)

### Discord Reply → LLM → Draft → Approve → Send
- Operator reply triggers Email lookup in DB
- LLM call with interpolated template generates draft
- `Draft` record saved with status `PENDING`
- Draft posted in Discord with Approve button + operator tagged
- `Draft.approvalMessageId` updated in DB
- Clicking Approve: Draft status → `APPROVED` → Gmail send → `SENT`
- Gmail send error: Draft status → `FAILED`, error posted in Discord
- LLM API error results in error message in Discord (no Draft created)

### Startup Recovery
- Pending emails with `discordMessageId` are loaded into in-memory map
- Pending drafts with `approvalMessageId` are loaded into in-memory map
- Bot can handle replies and approvals for pre-restart messages

## Mocking Strategy

| Dependency | Mock approach |
|-----------|---------------|
| PostgreSQL | Use test database with Prisma migrations (`bunx --bun prisma migrate deploy` on test DB); reset between test suites |
| Gmail API (read) | Mock `googleapis` client `users.messages.list` and `users.messages.get` responses |
| Gmail API (send) | Mock `googleapis` client `users.messages.send` responses |
| Discord.js | Mock `Client`, `TextChannel`, `Message`, `ButtonInteraction` objects |
| LLMProvider | Mock `LLMProvider` interface (provider-agnostic); for OpenAI-specific tests, mock `openai` SDK `chat.completions.create` |
