---
phase: planning
title: Project Planning & Task Breakdown
feature: email-discord-bot
---

# Project Planning & Task Breakdown — email-discord-bot

## Milestones

- [ ] M1: Project scaffold + config (TypeScript, env, HTTP server)
- [ ] M2: Gmail integration (OAuth2 + polling + parsing)
- [ ] M3: Discord integration (bot posts email + detects replies)
- [ ] M4: LLM integration (template + Claude API call)
- [ ] M5: State persistence + end-to-end wiring
- [ ] M6: Error handling, health check, polish

## Task Breakdown

### Phase 1: Foundation
- [ ] T1.1: Initialize TypeScript project — `package.json`, `tsconfig.json`, `src/index.ts` entry point
- [ ] T1.2: Create `src/config.ts` — load and validate all required env vars with clear error messages
- [ ] T1.3: Create `src/server/httpServer.ts` — minimal HTTP server with `/health` route
- [ ] T1.4: Create `.env.example` documenting all required environment variables

### Phase 2: Gmail Integration
- [ ] T2.1: Create `src/gmail/auth.ts` — OAuth2 client, token storage/refresh logic, `/oauth/callback` route handler
- [ ] T2.2: Create `src/gmail/poller.ts` — `setInterval`-based polling using Gmail `users.messages.list` with `historyId` tracking
- [ ] T2.3: Create `src/gmail/parser.ts` — extract `subject`, `from`, decoded `body` (plain text) from Gmail message payload
- [ ] T2.4: Create `src/state/store.ts` — read/write `state.json` for `lastHistoryId` and `processedMessageIds`

### Phase 3: Discord Integration
- [ ] T3.1: Create `src/discord/bot.ts` — discord.js client init, login, ready event
- [ ] T3.2: Create `src/discord/notifier.ts` — format email as Discord embed/message, mention fixed user, post to channel; store `discordMessageId → PendingEmail` map in memory
- [ ] T3.3: Create `src/discord/replyHandler.ts` — `messageCreate` listener that checks `message.reference`, looks up pending email, dispatches to LLM handler

### Phase 4: LLM Integration
- [ ] T4.1: Create `src/llm/template.ts` — load reply template from env/config file, interpolate placeholders (`{{subject}}`, `{{from}}`, `{{body}}`, `{{userReply}}`)
- [ ] T4.2: Create `src/llm/handler.ts` — call Anthropic Claude API with rendered prompt, return response text

### Phase 5: Wiring & State
- [ ] T5.1: Wire all modules in `src/index.ts` — start HTTP server, login Discord bot, start Gmail poller
- [ ] T5.2: Connect Gmail poller → Discord notifier (on new emails, post to Discord)
- [ ] T5.3: Connect Discord reply handler → LLM handler → post response back in Discord
- [ ] T5.4: Verify `state.json` persists across restarts and prevents re-forwarding of old emails

### Phase 6: Polish
- [ ] T6.1: Add error handling — Gmail poll errors, Discord post errors, LLM timeout/errors
- [ ] T6.2: Add `.gitignore` (`state.json`, `.env`, `node_modules`, `dist`)
- [ ] T6.3: Add `README.md` with setup instructions (OAuth setup, env vars, running the service)

## Dependencies

- T2.1 must complete before T2.2 (OAuth needed before API calls)
- T2.2, T2.3, T2.4 must complete before T5.2
- T3.1 must complete before T3.2 and T3.3
- T4.1, T4.2 must complete before T5.3
- T5.1–T5.4 must complete before T6.1

**External dependencies**:
- Google Cloud project with Gmail API enabled + OAuth2 credentials
- Discord bot created in Discord Developer Portal with `MESSAGE_CONTENT` intent enabled
- Anthropic API key

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Gmail OAuth2 setup complexity (consent screen, scopes) | Document step-by-step in README; test with `readonly` scope first |
| Discord `MESSAGE_CONTENT` privileged intent not enabled | Call it out in setup docs; enable in Dev Portal |
| Gmail API quota (250 quota units/user/second) | 30-min polling is well within quota |
| LLM latency / API errors | Wrap in try/catch; post error message in Discord so operator knows |
| `state.json` corruption on unclean shutdown | Write atomically (write to tmp then rename) |

## Resources Needed

- `googleapis` npm package (Gmail API client)
- `discord.js` npm package
- `@anthropic-ai/sdk` npm package
- Google Cloud Console access (Gmail API + OAuth2 credentials)
- Discord Developer Portal access (bot token + server invite)
- Anthropic API key
