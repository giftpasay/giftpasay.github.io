# Jekyll Biblical Publisher — MCP + Telegram Bot

A two-in-one tool for publishing Apostolic Pentecostal sermon notes to the
[UPC GIFT Pasay Jekyll blog](https://blog.giftpasay.com) on GitHub Pages.

| Mode | What it does |
|------|-------------|
| **Telegram Bot** | Send raw sermon notes from Telegram → Gemini formats them → published to GitHub |
| **MCP Server** | Exposes the same tools to GitHub Copilot / Claude in VS Code |

---

## How it works

```
Telegram message (raw notes)
         │
         ▼
   Gemini API (gemini-2.5-flash)
   ──────────────────────────────
   Apostolic writer system prompt
   → Jekyll frontmatter + body
         │
         ▼
   Imagen 4 (optional)
   → 1366×768 JPEG thumbnail
   → uploaded to assets/img/thumbnails/
         │
         ▼
   GitHub Contents API
   → commits to _posts/YYYY-MM-DD-slug.md
         │
         ▼
   GitHub Pages rebuild (< 2 min)
   → live on blog.giftpasay.com
```

---

## Setup

### 1. Install dependencies

```bash
cd tools/mcp-publisher
pip install -r requirements.txt
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env` and fill in all required values:

| Variable | Where to get it |
|----------|----------------|
| `GITHUB_TOKEN` | [GitHub → Settings → Fine-grained tokens](https://github.com/settings/tokens) — needs **Contents: Read & Write** on your repo |
| `GITHUB_OWNER` | Your GitHub username (`giftpasay`) |
| `GITHUB_REPO` | Repository name (`giftpasay.github.io`) |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `TELEGRAM_BOT_TOKEN` | Message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` |
| `ALLOWED_TELEGRAM_IDS` | Your Telegram user ID (message [@userinfobot](https://t.me/userinfobot)) |
| `SITE_BASE_URL` | Your blog URL (`https://blog.giftpasay.com`) |

### 3. Create a Telegram bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts.
3. Copy the bot token into `TELEGRAM_BOT_TOKEN` in your `.env`.
4. Set bot description: `/setdescription` → "UPC GIFT Pasay post publisher"
5. Set bot commands via `/setcommands`:
   ```
   start - Welcome and instructions
   preview - Format notes and choose action from buttons
   publish - Format and publish immediately with auto-thumbnail
   confirm - Publish the pending previewed post
   setimage - Attach a custom image URL to the pending post
   cancel - Discard pending draft
   list - Show 5 most recent posts
   help - Show help
   ```

---

## Running

### Telegram Bot (standalone daemon)

```bash
cd tools/mcp-publisher
python bot.py
```

Keep this running on a server, VPS, or your local machine.
For 24/7 use, consider running with `systemd`, `pm2`, or inside a Docker container.

### MCP Server (for VS Code / Claude Desktop)

The MCP server is auto-configured in `.vscode/mcp.json`. Restart VS Code and it
will appear in the GitHub Copilot agent tool list.

To run manually for testing:
```bash
cd tools/mcp-publisher
python server.py
```

---

## Telegram Bot Usage

### Workflow: paste notes → tap a button

1. Open your bot in Telegram.
2. Paste your raw sermon notes (any length).
3. The bot formats them with Gemini and shows a preview with action buttons:

```
[🎨 Generate thumbnail + Publish]   [🚀 Publish without image]
                   [❌ Cancel]
```

4. Tap a button. Done.
5. After publishing, a **↩ Revert this post** button appears — tap it to delete the post from GitHub if there is a mistake.

### Attaching a custom image URL before publishing

After the preview appears, send:
```
/setimage https://your-cdn.com/image.jpg
```
Then tap **Publish without image** — your URL will be used instead of auto-generation.

### Sending a photo as the thumbnail

Send a photo to the bot with your sermon notes as the **caption**. The bot will:
- Format the caption as the blog post
- Resize the photo to 1366×768 JPEG
- Upload it to `assets/img/thumbnails/` and embed it in the post
- Show a "Publish / Cancel" button

### Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/preview Your notes...` | Format and preview with action buttons |
| `/publish Your notes...` | Format and publish immediately with auto-thumbnail |
| `/setimage <url>` | Attach a custom image URL to the pending post |
| `/confirm` | Publish the pending post (generates thumbnail automatically) |
| `/cancel` | Discard the pending draft |
| `/list` | Show 5 most recent posts |
| `/help` | Show help |

### Inline buttons

| Button | When shown | Action |
|--------|-----------|--------|
| 🎨 Generate thumbnail + Publish | After preview | Creates a 1366×768 JPEG via Imagen 4, uploads it, then publishes |
| 🚀 Publish without image | After preview | Publishes immediately, no thumbnail |
| ❌ Cancel | After preview | Discards the draft |
| ↩ Revert this post | After publish | Deletes the post from GitHub (useful if there is an error) |

### Tips

- **Images:** Tap "🎨 Generate thumbnail" to create a topic-specific 1366×768 JPEG with Imagen 4, or send a photo as caption to use your own image, or use `/setimage <url>` for a remote URL.
- **Revert:** The ↩ Revert button is available immediately after publishing. It deletes the `_posts/` file from GitHub (thumbnail is kept in `assets/img/thumbnails/`).
- **No colons in titles:** Gemini is instructed never to use `:` in post titles since it breaks YAML frontmatter. Sanitization also runs automatically as a safeguard.
- **Filipino content:** Works fine — Gemini detects the language from your notes.
- **Long notes:** No length limit — paste entire transcriptions.

---

## MCP Tools (for VS Code / Claude)

| Tool | Description |
|------|-------------|
| `preview_post` | Format raw notes without publishing |
| `publish_post` | Format and publish to GitHub |
| `list_recent_posts` | List the 10 most recent posts |
| `get_post_content` | Fetch full content of a post by filename |

---

## Post Format Generated

Every post follows the Chirpy Jekyll theme format used on the blog:

```markdown
---
title: "Sermon Title"
date: 2025-06-08
categories: [Sermon Notes]
tags: [keyword1, keyword2, keyword3]
description: SEO-friendly one-line description.
image: https://cdn-url/image.jpg
comments: false
---

_Text: Acts 2:38_
_Preacher: Ptr. Sael Anota_

---

## Section Heading

Paragraph with **bold theological points** and scripture:

> "And they were all filled with the Holy Ghost..." — **Acts 2:4**
```

---

## Security Notes

- Always set `ALLOWED_TELEGRAM_IDS` to your own Telegram user ID.
  An open bot (no whitelist) could let anyone publish to your blog.
- Keep your `.env` file out of version control — it is in `.gitignore`.
- The GitHub token only needs **Contents: Read & Write** — do not give it more.
- Rotate your Telegram bot token if it is ever exposed publicly.
