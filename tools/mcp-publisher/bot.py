"""
Telegram Bot — Jekyll Biblical Publisher
Receives raw notes from authorized users and publishes them
to the UPC GIFT Pasay Jekyll blog on GitHub Pages.

Workflow:
  1. User pastes raw sermon notes (or uses /publish / /preview commands).
  2. Bot formats them with Gemini using the apostolic writer style.
  3. Bot shows a preview with inline action buttons.
  4. User taps a button: generate thumbnail + publish, publish without image, or cancel.
  5. Post is committed to GitHub and the live URL is sent back.
  6. A "Revert this post" button is shown after publishing.

Commands:
  /start        — Welcome message and instructions.
  /preview      — Format and preview notes with action buttons (no publish yet).
  /publish      — Format and publish immediately with auto-thumbnail.
  /confirm      — Publish the last previewed post (generates thumbnail automatically).
  /setimage URL — Attach a custom image URL to the pending post.
  /cancel       — Discard the pending preview.
  /list         — Show the 5 most recent posts.
  /help         — Show help text.

Inline buttons (shown after preview):
  🎨 Generate thumbnail + Publish — Creates a 1366×768 JPEG thumbnail via Imagen 4.
  🚀 Publish without image        — Posts without a thumbnail.
  ❌ Cancel                       — Discards the pending draft.
  ↩ Revert this post              — Deletes the post from GitHub after publishing.
"""

import html
import logging
import os
import re
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.error import TimedOut
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from formatter import (
    extract_frontmatter_value,
    format_post,
    generate_post,
    generate_thumbnail,
    make_filename,
    post_web_url,
)
from github_client import GitHubClient

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TELEGRAM_TOKEN: str = os.environ["TELEGRAM_BOT_TOKEN"]
GITHUB_TOKEN: str = os.environ["GITHUB_TOKEN"]
GITHUB_OWNER: str = os.environ["GITHUB_OWNER"]
GITHUB_REPO: str = os.environ["GITHUB_REPO"]
GEMINI_API_KEY: str = os.environ["GEMINI_API_KEY"]
SITE_BASE_URL: str = os.environ.get("SITE_BASE_URL", "https://blog.giftpasay.com")

# Comma-separated Telegram user IDs allowed to publish.
# Leave empty to allow ANY user (not recommended for public bots).
_raw_ids = os.environ.get("ALLOWED_TELEGRAM_IDS", "").strip()
ALLOWED_IDS: set[int] = {int(x) for x in _raw_ids.split(",") if x.strip()} if _raw_ids else set()

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# In-memory store: user_id → {"formatted": str, "image_url": Optional[str]}
pending: dict[int, dict] = {}
published: dict[int, dict] = {}  # stores {sha, post_path} after publish for revert
editing: set[int] = set()  # users currently sending an edited draft

# Detect "generate / write / create a post about <topic>" requests
_GENERATE_RE = re.compile(
    r'^\s*(generate|write|create)\s+.{0,40}(about|on|for|related to)\b',
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

def _is_allowed(user_id: int) -> bool:
    """Return True if the user is authorized."""
    if not ALLOWED_IDS:
        return True  # open mode — protect with a private bot instead
    return user_id in ALLOWED_IDS


# ---------------------------------------------------------------------------
# GitHub helper (thin wrapper)
# ---------------------------------------------------------------------------

def _github() -> GitHubClient:
    return GitHubClient(token=GITHUB_TOKEN, owner=GITHUB_OWNER, repo=GITHUB_REPO)


# ---------------------------------------------------------------------------
# Shared formatting + publishing logic
# ---------------------------------------------------------------------------

async def _format_notes(raw: str, image_url: Optional[str] = None) -> str:
    notes = raw
    if image_url:
        notes = f"Featured Image URL: {image_url}\n\n{raw}"
    return format_post(notes, GEMINI_API_KEY)


async def _publish(
    formatted: str,
    image_url: Optional[str] = None,
    generate_thumb: bool = False,
) -> dict:
    title = extract_frontmatter_value(formatted, "title")
    description = extract_frontmatter_value(formatted, "description")
    date = extract_frontmatter_value(formatted, "date") or datetime.now().strftime("%Y-%m-%d")
    filename = make_filename(title, date)
    slug = filename[len(date) + 1: -len(".md")]
    gh = _github()

    thumb_path: Optional[str] = None
    existing_image = extract_frontmatter_value(formatted, "image")

    if existing_image:
        pass  # already set in frontmatter — leave it alone
    elif image_url:
        formatted = re.sub(r'(?m)^image:\s*$', f'image: {image_url}', formatted, count=1)
        thumb_path = image_url
    elif generate_thumb:
        try:
            tags = extract_frontmatter_value(formatted, "tags")
            img_bytes = generate_thumbnail(title, description, GEMINI_API_KEY, tags)
            thumb_path = gh.upload_image(f"{slug}.jpg", img_bytes)
            formatted = re.sub(r'(?m)^image:\s*$', f'image: {thumb_path}', formatted, count=1)
        except Exception as exc:
            logger.warning(f"Thumbnail generation failed: {exc}")

    result = gh.create_post(filename, formatted)
    web_url = post_web_url(date, filename, SITE_BASE_URL)
    return {
        "filename": filename,
        "web_url": web_url,
        "github_url": result["content"]["html_url"],
        "sha": result["content"]["sha"],
        "post_path": f"_posts/{filename}",
        "thumbnail": thumb_path,
    }


def _truncate(text: str, limit: int = 3000) -> str:
    return text if len(text) <= limit else text[:limit] + "\n\n_(preview truncated)_"


def _preview_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🎨 Generate thumbnail + Publish", callback_data="thumb"),
            InlineKeyboardButton("🚀 Publish without image", callback_data="noimg"),
        ],
        [
            InlineKeyboardButton("✏️ Edit", callback_data="edit"),
            InlineKeyboardButton("❌ Cancel", callback_data="cancel"),
        ],
    ])


async def _show_preview(update: Update, uid: int, formatted: str) -> None:
    """Store post in pending and display preview with action keyboard."""
    title = extract_frontmatter_value(formatted, "title")
    date = extract_frontmatter_value(formatted, "date") or datetime.now().strftime("%Y-%m-%d")
    filename = make_filename(title, date)
    pending[uid] = {"formatted": formatted, "image_url": None}
    preview_text = _truncate(formatted)
    await update.message.reply_text(
        f"<b>Draft ready:</b> <code>{html.escape(filename)}</code>\n\n"
        f"<pre>{html.escape(preview_text)}</pre>\n\n"
        "Tip: send <code>/setimage &lt;url&gt;</code> before publishing to attach a custom thumbnail.",
        parse_mode="HTML",
        reply_markup=_preview_keyboard(),
    )


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    if not _is_allowed(uid):
        await update.message.reply_text("Sorry, you are not authorized to use this bot.")
        return

    await update.message.reply_text(
        "👋 *Welcome to the GIFT Pasay Jekyll Publisher!*\n\n"
        "Send me raw sermon notes or a transcription and I will format it into a "
        "blog post using the apostolic writing style, then publish it to GitHub Pages.\n\n"
        "*Quickest way:* Just paste your notes — action buttons appear automatically.\n"
        "*With photo:* Send a photo with your notes as the caption to use it as the thumbnail.\n\n"
        "*Commands:*\n"
        "/preview — Format and preview (choose action from buttons)\n"
        "/publish — Format and publish immediately with auto-thumbnail\n"
        "/confirm — Publish the pending preview (auto-thumbnail)\n"
        "/setimage <url> — Attach a custom image URL to the pending post\n"
        "/cancel  — Discard the pending draft\n"
        "/list    — Show the 5 most recent posts\n"
        "/help    — Show this message\n\n"
        "*After publishing*, tap *↩ Revert this post* to delete it from GitHub if needed.",
        parse_mode=ParseMode.MARKDOWN,
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await start(update, context)


async def preview_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    if not _is_allowed(uid):
        await update.message.reply_text("Not authorized.")
        return

    raw = " ".join(context.args) if context.args else None
    if not raw:
        await update.message.reply_text(
            "Please include your notes after the command.\n"
            "Example: `/preview Your sermon notes here...`",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    await update.message.reply_text("Formatting your notes... please wait.")
    try:
        formatted = await _format_notes(raw)
    except Exception as exc:
        logger.exception("Formatting error")
        await update.message.reply_text(f"Error formatting post: {exc}")
        return

    await _show_preview(update, uid, formatted)


async def publish_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    if not _is_allowed(uid):
        await update.message.reply_text("Not authorized.")
        return

    raw = " ".join(context.args) if context.args else None
    if not raw:
        await update.message.reply_text(
            "Please include your notes after the command.\n"
            "Example: `/publish Your sermon notes here...`",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    await update.message.reply_text(
        "Formatting and publishing... generating thumbnail with Imagen 4, please wait."
    )
    try:
        formatted = await _format_notes(raw)
        result = await _publish(formatted, generate_thumb=True)
    except Exception as exc:
        logger.exception("Publish error")
        await update.message.reply_text(f"Error: {exc}")
        return

    published[uid] = {"sha": result["sha"], "post_path": result["post_path"]}
    thumb_line = f"\U0001f5bc <code>{html.escape(result['thumbnail'])}</code>\n" if result.get("thumbnail") else ""
    await update.message.reply_text(
        f"\u2705 <b>Post published!</b>\n\n"
        f"\U0001f4c4 <code>{html.escape(result['filename'])}</code>\n"
        f"{thumb_line}"
        f"\U0001f310 <a href='{result['web_url']}'>View live post</a>\n\n"
        f"<i>GitHub Pages usually rebuilds in under 2 minutes.</i>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("↩ Revert this post", callback_data="revert")]])
    )


async def confirm_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    if not _is_allowed(uid):
        await update.message.reply_text("Not authorized.")
        return

    post_data = pending.pop(uid, None)
    if not post_data:
        await update.message.reply_text(
            "No pending post to confirm. Use /preview first."
        )
        return

    await update.message.reply_text(
        "Publishing... generating thumbnail with Imagen 4, please wait."
    )
    try:
        result = await _publish(
            post_data["formatted"],
            post_data.get("image_url"),
            generate_thumb=True,
        )
    except Exception as exc:
        logger.exception("Publish error")
        await update.message.reply_text(f"Error publishing: {exc}")
        return

    published[uid] = {"sha": result["sha"], "post_path": result["post_path"]}
    thumb_line = f"\U0001f5bc <code>{html.escape(result['thumbnail'])}</code>\n" if result.get("thumbnail") else ""
    await update.message.reply_text(
        f"\u2705 <b>Post published!</b>\n\n"
        f"\U0001f4c4 <code>{html.escape(result['filename'])}</code>\n"
        f"{thumb_line}"
        f"\U0001f310 <a href='{result['web_url']}'>View live post</a>\n\n"
        f"<i>GitHub Pages usually rebuilds in under 2 minutes.</i>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("↩ Revert this post", callback_data="revert")]])
    )


async def cancel_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    if pending.pop(uid, None):
        await update.message.reply_text("Pending post discarded.")
    else:
        await update.message.reply_text("No pending post to cancel.")


async def list_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    if not _is_allowed(uid):
        await update.message.reply_text("Not authorized.")
        return

    try:
        posts = _github().list_posts(5)
    except Exception as exc:
        await update.message.reply_text(f"Error fetching posts: {exc}")
        return

    if not posts:
        await update.message.reply_text("No posts found.")
        return

    lines = ["*Recent posts:*\n"]
    for p in posts:
        lines.append(f"• `{p['name']}`")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)


# ---------------------------------------------------------------------------
# Plain text handler — ask before publishing
# ---------------------------------------------------------------------------

async def text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    if not _is_allowed(uid):
        await update.message.reply_text("Not authorized.")
        return

    raw = update.message.text.strip()
    if not raw:
        return

    # If the user is in edit mode, replace pending content and re-show preview
    if uid in editing:
        editing.discard(uid)
        if uid not in pending:
            await update.message.reply_text("No pending post found. Please format your notes again.")
            return
        pending[uid]["formatted"] = raw
        await update.message.reply_text("✅ Draft updated.")
        await _show_preview(update, uid, raw)
        return

    if _GENERATE_RE.search(raw):
        await update.message.reply_text("\u270d\ufe0f Generating original post... please wait.")
        try:
            formatted = generate_post(raw, GEMINI_API_KEY)
        except Exception as exc:
            logger.exception("Generation error")
            await update.message.reply_text(f"Error generating post: {exc}")
            return
    else:
        await update.message.reply_text("\U0001f4dd Formatting your notes... please wait.")
        try:
            formatted = await _format_notes(raw)
        except Exception as exc:
            logger.exception("Formatting error")
            await update.message.reply_text(f"Error formatting post: {exc}")
            return

    await _show_preview(update, uid, formatted)


# ---------------------------------------------------------------------------
# Inline keyboard callback handler
# ---------------------------------------------------------------------------

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    try:
        await query.answer()
    except TimedOut:
        pass  # answer() timeout is harmless — the callback still runs
    uid = query.from_user.id

    if not _is_allowed(uid):
        await query.edit_message_text("Not authorized.")
        return

    action = query.data  # "thumb" | "noimg" | "cancel" | "revert" | "edit"

    if action == "edit":
        if uid not in pending:
            await query.edit_message_text("No pending post to edit. Format your notes first.")
            return
        editing.add(uid)
        await query.edit_message_text(
            "✏️ <b>Edit mode.</b>\n\n"
            "Send your corrected post text now (full markdown including frontmatter).\n"
            "You can copy the preview, paste it into your editor, fix it, then send it back.",
            parse_mode="HTML",
        )
        return

    if action == "revert":
        pub = published.pop(uid, None)
        if not pub:
            await query.edit_message_text("No recent post to revert.")
            return
        try:
            _github().delete_file(pub["post_path"], pub["sha"])
            await query.edit_message_text(
                f"Post reverted and deleted from GitHub.\n<code>{html.escape(pub['post_path'])}</code>",
                parse_mode="HTML",
            )
        except Exception as exc:
            await query.edit_message_text(f"Error reverting: {html.escape(str(exc))}", parse_mode="HTML")
        return

    if action == "cancel":
        pending.pop(uid, None)
        await query.edit_message_text("Post discarded.")
        return

    post_data = pending.pop(uid, None)
    if not post_data:
        await query.edit_message_text("No pending post. Please format new notes first.")
        return

    if action == "thumb":
        await query.edit_message_text(
            "Publishing... generating thumbnail with Imagen 4, please wait."
        )
        gen_thumb = True
    else:  # noimg
        await query.edit_message_text("Publishing...")
        gen_thumb = False

    try:
        result = await _publish(
            post_data["formatted"],
            post_data.get("image_url"),
            generate_thumb=gen_thumb,
        )
    except Exception as exc:
        logger.exception("Publish error")
        await query.edit_message_text(f"Error publishing: {exc}")
        return

    published[uid] = {"sha": result["sha"], "post_path": result["post_path"]}
    thumb_line = f"\U0001f5bc <code>{html.escape(result['thumbnail'])}</code>\n" if result.get("thumbnail") else ""
    await query.edit_message_text(
        f"\u2705 <b>Post published!</b>\n\n"
        f"\U0001f4c4 <code>{html.escape(result['filename'])}</code>\n"
        f"{thumb_line}"
        f"\U0001f310 <a href='{result['web_url']}'>View live post</a>\n\n"
        f"<i>GitHub Pages usually rebuilds in under 2 minutes.</i>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("↩ Revert this post", callback_data="revert")]])
    )


# ---------------------------------------------------------------------------
# /setimage — attach a custom thumbnail URL to the pending post
# ---------------------------------------------------------------------------

async def setimage_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    if not _is_allowed(uid):
        await update.message.reply_text("Not authorized.")
        return

    url = " ".join(context.args).strip() if context.args else ""
    if not url.startswith(("http://", "https://")):
        await update.message.reply_text(
            "Usage: `/setimage https://your-image-url.jpg`",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    if uid not in pending:
        await update.message.reply_text(
            "No pending post. Format your notes first, then set the image."
        )
        return

    pending[uid]["image_url"] = url
    await update.message.reply_text(
        f"Image URL saved.\n\nNow choose an option to publish:",
        reply_markup=_preview_keyboard(),
    )


# ---------------------------------------------------------------------------
# Document handler — read .txt file as sermon notes
# ---------------------------------------------------------------------------

MAX_TXT_BYTES = 200_000  # ~200 KB safety cap

async def document_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    if not _is_allowed(uid):
        await update.message.reply_text("Not authorized.")
        return

    doc = update.message.document
    mime = doc.mime_type or ""
    fname = doc.file_name or ""

    if mime not in ("text/plain", "application/octet-stream") and not fname.lower().endswith(".txt"):
        await update.message.reply_text(
            "Please send a <b>.txt</b> file. Other file types are not supported.",
            parse_mode="HTML",
        )
        return

    if doc.file_size and doc.file_size > MAX_TXT_BYTES:
        await update.message.reply_text(
            f"File is too large ({doc.file_size // 1024} KB). Maximum is {MAX_TXT_BYTES // 1024} KB."
        )
        return

    await update.message.reply_text(
        f"\U0001f4c4 Reading <code>{html.escape(fname)}</code>... please wait.",
        parse_mode="HTML",
    )

    try:
        tg_file = await doc.get_file()
        raw_bytes = await tg_file.download_as_bytearray()
        # Decode — try UTF-8 first, fall back to latin-1
        try:
            raw = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raw = raw_bytes.decode("latin-1")
        raw = raw.strip()
    except Exception as exc:
        logger.exception("File download error")
        await update.message.reply_text(f"Error reading file: {exc}")
        return

    if not raw:
        await update.message.reply_text("The file appears to be empty.")
        return

    if _GENERATE_RE.search(raw):
        await update.message.reply_text("\u270d\ufe0f Generating original post... please wait.")
        try:
            formatted = generate_post(raw, GEMINI_API_KEY)
        except Exception as exc:
            logger.exception("Generation error")
            await update.message.reply_text(f"Error generating post: {exc}")
            return
    else:
        await update.message.reply_text("\U0001f4dd Formatting notes from file... please wait.")
        try:
            formatted = await _format_notes(raw)
        except Exception as exc:
            logger.exception("Formatting error")
            await update.message.reply_text(f"Error formatting post: {exc}")
            return

    await _show_preview(update, uid, formatted)


# ---------------------------------------------------------------------------
# Photo handler — use attached photo as thumbnail, caption as notes
# ---------------------------------------------------------------------------

async def photo_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    if not _is_allowed(uid):
        await update.message.reply_text("Not authorized.")
        return

    caption = (update.message.caption or "").strip()
    if not caption:
        await update.message.reply_text(
            "Please add your sermon notes as the photo caption. "
            "The photo will be resized and used as the thumbnail."
        )
        return

    await update.message.reply_text("Formatting your notes and uploading photo...")
    try:
        formatted = await _format_notes(caption)
    except Exception as exc:
        logger.exception("Formatting error")
        await update.message.reply_text(f"Error formatting post: {exc}")
        return

    # Download and resize the photo to 1366x768 JPEG
    from io import BytesIO
    from PIL import Image as PILImage

    title = extract_frontmatter_value(formatted, "title")
    date = extract_frontmatter_value(formatted, "date") or datetime.now().strftime("%Y-%m-%d")
    filename = make_filename(title, date)
    slug = filename[len(date) + 1: -len(".md")]

    try:
        photo_file = await update.message.photo[-1].get_file()
        raw_bytes = await photo_file.download_as_bytearray()
        img = PILImage.open(BytesIO(bytes(raw_bytes))).convert("RGB")
        img = img.resize((1366, 768), PILImage.LANCZOS)
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=90, optimize=True)
        thumb_path = _github().upload_image(f"{slug}.jpg", buf.getvalue())
        formatted = re.sub(r'(?m)^image:\s*$', f'image: {thumb_path}', formatted, count=1)
        await update.message.reply_text(
            f"Photo uploaded as thumbnail: <code>{html.escape(thumb_path)}</code>",
            parse_mode="HTML",
        )
    except Exception as exc:
        logger.warning(f"Photo upload failed: {exc}")

    pending[uid] = {"formatted": formatted, "image_url": None}
    preview_text = _truncate(formatted)
    await update.message.reply_text(
        f"<b>Draft ready:</b> <code>{html.escape(filename)}</code>\n\n"
        f"<pre>{html.escape(preview_text)}</pre>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🚀 Publish", callback_data="noimg")],
            [InlineKeyboardButton("❌ Cancel", callback_data="cancel")],
        ]),
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    app = (
        Application.builder()
        .token(TELEGRAM_TOKEN)
        .connect_timeout(30)
        .read_timeout(60)
        .write_timeout(60)
        .pool_timeout(30)
        .build()
    )

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("preview", preview_command))
    app.add_handler(CommandHandler("publish", publish_command))
    app.add_handler(CommandHandler("confirm", confirm_command))
    app.add_handler(CommandHandler("cancel", cancel_command))
    app.add_handler(CommandHandler("list", list_command))
    app.add_handler(CommandHandler("setimage", setimage_command))
    _txt_filter = (
        filters.Document.MimeType("text/plain")
        | filters.Document.FileExtension("txt")
    )
    app.add_handler(CallbackQueryHandler(button_callback))
    app.add_handler(MessageHandler(_txt_filter & filters.UpdateType.MESSAGE, document_message))
    app.add_handler(MessageHandler(filters.PHOTO & filters.UpdateType.MESSAGE, photo_message))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND & filters.UpdateType.MESSAGE, text_message))

    logger.info("Bot started. Listening for messages...")
    app.run_polling(allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    main()
