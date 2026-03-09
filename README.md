# email-discord-bot

Polls Gmail for incoming emails, forwards them to a Discord channel, lets an operator reply with instructions, uses an LLM to draft a reply, and sends the approved draft back via Gmail.

## Flow

1. Gmail is polled every 30 min → new emails posted to Discord (embed + operator mention)
2. Operator replies to the Discord post with instructions
3. Backend combines email context + instructions → LLM generates an HTML email draft
4. Draft is posted in Discord with an **Approve** button
5. Operator clicks Approve → email sent via Gmail API (threaded reply)
6. All state persisted in PostgreSQL via Prisma

---

## Prerequisites

- [Bun](https://bun.sh) v1.3+
- PostgreSQL database
- Google Cloud project with Gmail API enabled
- Discord bot with `MESSAGE_CONTENT` intent enabled
- OpenAI API key

---

## Setup

### 1. Install dependencies

```sh
bun install
```

### 2. PostgreSQL

Create a database:

```sql
CREATE DATABASE email_discord_bot;
```

Or with Docker:

```sh
docker run -d \
  --name postgres \
  -e POSTGRES_USER=myuser \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=email_discord_bot \
  -p 5432:5432 \
  postgres:16
```

### 3. Environment variables

Copy `.env.example` to `.env` and fill in all values:

```sh
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://user:pass@host:5432/email_discord_bot`) |
| `GOOGLE_CLIENT_ID` | OAuth2 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | Obtained during OAuth2 setup (see below) |
| `GOOGLE_REDIRECT_URI` | OAuth2 redirect URI (default: `http://localhost:3000/oauth/callback`) |
| `DISCORD_BOT_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CHANNEL_ID` | Channel ID where emails and drafts are posted |
| `DISCORD_OPERATOR_USER_ID` | Discord user ID to mention for each email |
| `DISCORD_GUILD_ID` | *(optional)* Guild ID for dev slash command deployment |
| `DISCORD_CLIENT_ID` | *(optional)* Application ID — needed only for `deploy:commands` |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | *(optional)* Model name (default: `gpt-4o`) |
| `LLM_PROVIDER` | *(optional)* LLM provider (default: `openai`) |
| `PORT` | *(optional)* HTTP server port (default: `3000`) |
| `POLL_INTERVAL_MS` | *(optional)* Gmail poll interval in ms (default: `1800000` = 30 min) |

### 4. Gmail OAuth2 setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:3000/oauth/callback` as an authorized redirect URI
4. Enable the **Gmail API** for your project
5. Start the bot temporarily, then visit the auth URL:

```sh
bun run src/index.ts
# In another terminal:
bunx tsx -e "import('./src/gmail/auth.ts').then(m => console.log(m.getAuthUrl()))"
```

6. Open the printed URL in your browser, sign in, and authorize
7. Copy the `refresh_token` from the server logs → set as `GOOGLE_REFRESH_TOKEN` in `.env`

**Required scopes:** `gmail.readonly`, `gmail.send`

### 5. Discord bot setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application → Bot → copy the token → set as `DISCORD_BOT_TOKEN`
3. Under **Privileged Gateway Intents**, enable **Message Content Intent**
4. Invite the bot to your server with permissions: `Send Messages`, `Read Message History`, `Embed Links`, `Use Application Commands`
5. Copy the channel ID where emails should be posted → set as `DISCORD_CHANNEL_ID`
6. Copy your Discord user ID → set as `DISCORD_OPERATOR_USER_ID`

### 6. Run database migrations

```sh
bunx --bun prisma migrate deploy
```

Or for development (with migration history):

```sh
bunx --bun prisma migrate dev
```

### 7. Start the bot

```sh
bun run src/index.ts
```

---

## npm scripts

| Script | Description |
|---|---|
| `bun run dev` | Start the bot (`src/index.ts`) |
| `bun run db:migrate` | Run Prisma migrations (dev) |
| `bun run db:deploy` | Apply migrations (production) |
| `bun run db:generate` | Regenerate Prisma client |
| `bun run db:studio` | Open Prisma Studio |
| `bun run deploy:commands` | Register Discord slash commands |

---

## Health check

```sh
curl http://localhost:3000/health
# {"status":"ok","db":"connected"}
```

Returns `503` if the database is unreachable.

---

## Architecture

```
Gmail API  ──poll──►  poller.ts  ──onNewEmail──►  notifier.ts  ──embed──►  Discord
                                                                              │
                                                                    operator replies
                                                                              │
                                                              replyHandler.ts ◄─┘
                                                                      │
                                                              llm/handler.ts
                                                                      │
                                                              notifier.ts (draft + Approve button)
                                                                      │
                                                            operator clicks Approve
                                                                      │
                                                          approvalHandler.ts
                                                                      │
                                                              Gmail sender  ──►  threaded reply
```
