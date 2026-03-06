---
phase: requirements
title: Requirements & Problem Understanding
feature: email-discord-bot
---

# Requirements & Problem Understanding — email-discord-bot

## Problem Statement

Incoming emails to Gmail need human attention but there is no efficient notification or response workflow. Manually checking Gmail and crafting replies is slow. The goal is to surface incoming emails directly in Discord so the responsible person can respond quickly, with LLM assistance generating templated replies.

**Who is affected**: A single operator who wants to triage and reply to emails from within Discord without switching to Gmail.

**Current workaround**: Manually checking Gmail and replying by hand.

## Goals & Objectives

**Primary goals**:
- Poll Gmail every 30 minutes and forward new emails to a Discord channel
- Mention a fixed Discord user so they are notified immediately
- Accept the user's Discord reply, pass it to an LLM with a predefined template, and post the AI-generated response back in the Discord thread

**Non-goals**:
- Sending emails back via Gmail (no outbound email — Discord only)
- Multi-user routing or dynamic mention logic
- A heavy backend / database layer
- Mobile push notifications

## User Stories & Use Cases

- As the operator, I want to see new Gmail messages appear in a Discord channel so I don't need to check Gmail manually.
- As the operator, I want the bot to mention me so I get a Discord notification for each new email.
- As the operator, I want to reply to the bot in Discord and receive a templated LLM response so I can quickly decide how to handle the email.
- As the operator, I want the polling to happen automatically every 30 minutes without any manual trigger.

**Edge cases**:
- Email received while bot is restarting → picked up on next poll cycle (no email is permanently missed as long as last-seen message ID is persisted)
- Multiple new emails arrive between polls → each forwarded as a separate Discord message
- Discord user does not reply → no LLM call made; no side effects
- LLM API is unavailable → bot replies with an error message in Discord

## Success Criteria

- New Gmail emails appear in the Discord channel within 30 minutes of arrival
- The configured Discord user is mentioned in every forwarded email post
- When the Discord user replies to a bot message, the bot posts an LLM-generated response (following the template) within 10 seconds
- The service runs continuously as part of the existing TypeScript HTTP server process

## Constraints & Assumptions

**Technical constraints**:
- TypeScript project; simple HTTP server (no framework required beyond Node.js built-ins or a minimal lib)
- Gmail access via Gmail API (OAuth2); no IMAP/SMTP
- Discord integration via discord.js bot
- LLM calls via Claude API (Anthropic SDK)
- All secrets (Gmail OAuth tokens, Discord bot token, Discord channel/user IDs, LLM key) stored in environment variables
- No database; state (last processed Gmail message ID) persisted in a local JSON file

**Assumptions**:
- Gmail OAuth2 credentials are already created in Google Cloud Console (or will be set up as part of this feature)
- The Discord bot is already added to the server with message read/write permissions (or will be set up)
- Only one Gmail inbox is monitored
- The fixed Discord user ID is known and set via env var

## Questions & Open Items

- What LLM reply template should the bot use? (format / placeholders to be defined by operator in config)
- Should the bot track which Discord messages are "replies to email posts" using Discord thread replies, or any message in the channel mentioning the bot?
- Should processed email IDs be stored per-session (in memory) or persisted across restarts (file)?
  - Assumption: persisted to a local JSON file to avoid re-forwarding after restart
