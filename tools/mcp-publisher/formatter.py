"""
Format raw sermon notes / transcriptions into Jekyll markdown posts
using Google Gemini, following the biblical writing style of UPC GIFT Pasay.

Text model:  gemini-3.1-flash-lite  (500 RPD free tier, 15 RPM)
Image model: imagen-4.0-fast-generate-preview (25 RPD free tier)
"""

import re
import time
import unicodedata
from datetime import datetime
from io import BytesIO

from google import genai
from google.genai import types as genai_types
from PIL import Image

# ---------------------------------------------------------------------------
# Model selection
# ---------------------------------------------------------------------------

TEXT_MODEL  = "gemini-2.5-flash"   # confirmed available: 5 RPM, 20 RPD free tier
IMAGE_MODEL = "imagen-4.0-fast-generate-preview"  # 25 RPD free tier


# ---------------------------------------------------------------------------
# Formatting prompt
# ---------------------------------------------------------------------------

_COMMON_RULES = """\
## Writing and tone rules
- Write in a warm, pastoral, apostolic voice that sounds like a trusted minister \
sharing truth, not a robot listing bullet points.
- Write in easy English so both new believers and seekers can understand.
- Use "Holy Ghost" consistently — never "Holy Spirit" alone.
- Preserve all scripture references exactly; format them as blockquotes with a bold \
citation at the end, e.g.:
  > "Text of verse..." — **Acts 2:38**
- Bold key theological statements and pivotal truths.
- Vary sentence length for natural rhythm. Mix short punchy sentences with longer ones.
- Never use em dashes (—). Use commas, colons, or parentheses instead.
- Write to both believers and seekers.
- Use second person ("you", "we") for direct reader engagement.
- Doctrinal position: Oneness Apostolic (one God, not Trinity; baptism in Jesus' name \
only per Acts 2:38; Holy Ghost with tongues is the initial evidence of salvation).

## Structure rules
- Opening paragraph: vivid hook that draws the reader in.
- ## Headings for each main section.
- Closing section: a call to action or exhortation.
- If a preacher name, scripture text, or service name is mentioned, place it right \
after the frontmatter closing ---, formatted like:
    _Text: Book Chapter:Verse_ \\\\
    _Preacher: Name_
  followed by a horizontal rule (---).
- Do NOT add `<!-- suggest internal link -->` comments.

## Jekyll frontmatter (YAML, between --- delimiters)
Output ALL of these fields in this exact order:
---
title: "Compelling SEO-friendly title here"
date: YYYY-MM-DD
categories: [Sermon Notes]
tags: [tag1, tag2, tag3, tag4, tag5]
description: Single sentence under 160 characters good for SEO.
image:
comments: false
---

- title: NEVER use a colon (:) in the title — use a comma, dash, or reword instead. \
  Bad: "Baptism: The First Step" Good: "Baptism, The First Step". \
  Bad: "Acts 2:38 Explained" Good: "Acts 2 38 Explained". \
  The title must be safe as a YAML scalar without escaping.
- date: YYYY-MM-DD format (use the date provided; default to today if none given).
- categories: one of: [Sermon Notes] / [Bible Study, Theology] / \
  [Bible Study, Eschatology] / [Devotional] / [Apostolic Identity]
- tags: 5-8 tags, ALL LOWERCASE, NO exceptions. \
  NEVER use Title Case, Sentence case, or UPPERCASE for tags — every character must be a \
  small letter or hyphen. \
  Bad: [Holy Ghost, Baptism, Acts 2, Jesus Name] \
  Good: [holy ghost, baptism, acts 2, jesus name] \
  Bad: [Evangelism, Soul Winning] Good: [evangelism, soul winning]
- description: Single sentence under 160 characters, good for SEO.
- image: Leave BLANK — do not put any value here. The system will fill it in.
- comments: false

## CRITICAL OUTPUT RULE
Output EXACTLY ONE complete Jekyll post. Do NOT produce multiple versions, \
alternatives, devotional variants, or any other text. Start immediately with --- \
and end after the last line of the post body. No code fences, no explanations.\
"""

FORMAT_SYSTEM_PROMPT = (
    "You are the official biblical writer for UPC GIFT PASAY, an Apostolic Pentecostal "
    "church in Pasay, Philippines (blog: blog.giftpasay.com).\n\n"
    "Your task is to REFORMAT raw sermon notes or transcriptions into a clean, "
    "well-structured Jekyll blog post. KEEP the original message intact — do NOT add "
    "new theology, invent scripture references, or change the speaker's content. "
    "Your role is to clarify, structure, and polish in easy English, not to rewrite "
    "or expand the content.\n\n"
    + _COMMON_RULES
)

GENERATE_SYSTEM_PROMPT = (
    "You are the official biblical writer for UPC GIFT PASAY, an Apostolic Pentecostal "
    "church in Pasay, Philippines (blog: blog.giftpasay.com).\n\n"
    "Your task is to WRITE AN ORIGINAL blog post on the given topic, from the perspective "
    "of a Spirit-filled Apostolic Pentecostal Oneness believer. "
    "Write in easy English that both new believers and seekers can understand. "
    "Draw from scripture, Apostolic doctrine, and pastoral wisdom to produce a rich, "
    "encouraging, and biblically grounded post.\n\n"
    + _COMMON_RULES
)

# Keep SYSTEM_PROMPT as an alias for backward compatibility with server.py
SYSTEM_PROMPT = FORMAT_SYSTEM_PROMPT


def _sanitize_tags(post: str) -> str:
    """
    Force every tag value in the YAML frontmatter tags list to lowercase.
    Handles both single-line  tags: [Tag1, Tag Two]  and
    multi-line  tags:\n  - Tag1\n  - Tag Two  formats.
    """
    def _lower_list(m: re.Match) -> str:
        return m.group(0).lower()

    # Single-line: tags: [Foo, Bar Baz]
    post = re.sub(
        r'(?m)^(tags:\s*\[)([^\]]+)(\])',
        lambda m: m.group(1) + m.group(2).lower() + m.group(3),
        post,
    )
    # Multi-line block: each "  - Tag Value" line inside frontmatter
    # Only match lines that are part of a tags block (indented list items)
    # We do a pass that lowercases every "  - Word" line between tags: and the next key
    def _lower_tags_block(m: re.Match) -> str:
        header = m.group(1)   # 'tags:'
        items = m.group(2)    # the block of '\n  - ...' lines
        return header + items.lower()

    post = re.sub(
        r'(?m)(^tags:\s*\n)((?:[ \t]+-[ \t]+[^\n]+\n?)+)',
        _lower_tags_block,
        post,
    )
    return post


def _sanitize_title(post: str) -> str:
    """
    Remove colons from the title line in the frontmatter.
    Colons in a YAML title break Jekyll's front matter parser even when quoted.
    Replace ': ' with ' - ' and lone ':' with an empty string.
    """
    def _fix(m: re.Match) -> str:
        original = m.group(0)          # full matched line
        title_val = m.group(1)         # the value between quotes (or bare)
        fixed = title_val.replace(": ", " - ").replace(":", "")
        return original.replace(title_val, fixed)

    # Match:  title: "Some Title"  or  title: Some Title
    post = re.sub(
        r'(?m)^(title:\s*["\']?)([^\n\'"]+)(["\']?)$',
        lambda m: m.group(1) + m.group(2).replace(": ", " - ").replace(":", "") + m.group(3),
        post,
    )
    return post


def _clean_response(text: str) -> str:
    """
    Strip markdown code fences Gemini sometimes wraps around the output,
    and ensure we return exactly ONE Jekyll post (cut any second post Gemini adds).
    """
    t = text.strip()
    # Remove ``` fences
    t = re.sub(r'^```[a-zA-Z]*\r?\n', '', t)
    t = re.sub(r'\r?\n```\s*$', '', t)
    t = t.strip()
    # Ensure output starts at the first frontmatter ---
    if not t.startswith('---'):
        m = re.search(r'(?m)^---\s*$', t)
        if m:
            t = t[m.start():]
    # Truncate at any second post: another "---\ntitle:" block appearing in the body
    fm_end = re.search(r'(?m)^---\s*$', t[3:])
    if fm_end:
        body_start = 3 + fm_end.end()
        second_post = re.search(r'(?m)^---\s*\ntitle:', t[body_start:])
        if second_post:
            t = t[:body_start + second_post.start()].rstrip()
    return t


def format_post(raw_notes: str, api_key: str, date_override: str | None = None) -> str:
    """
    Call Gemini to format raw_notes into a Jekyll markdown post.

    Args:
        raw_notes:      Raw sermon notes or transcription.
        api_key:        Google Gemini API key.
        date_override:  Optional YYYY-MM-DD date to inject into the prompt.

    Returns:
        Formatted Jekyll post string starting with ---
    """
    today = date_override or datetime.now().strftime("%Y-%m-%d")

    client = genai.Client(api_key=api_key)
    user_message = (
        f"Today's date is {today}.\n\n"
        "Reformat the following sermon notes into a Jekyll blog post:\n\n"
        f"{raw_notes}"
    )

    # Retry up to 3 times on 429 rate-limit errors, honouring the retry-after delay.
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=TEXT_MODEL,
                contents=user_message,
                config=genai_types.GenerateContentConfig(
                    system_instruction=FORMAT_SYSTEM_PROMPT,
                    temperature=0.7,
                ),
            )
            return _sanitize_tags(_sanitize_title(_clean_response(response.text.strip())))
        except Exception as exc:
            msg = str(exc)
            if "429" in msg and attempt < 2:
                m = re.search(r"retry in ([\d.]+)s", msg)
                wait = float(m.group(1)) if m else 20.0
                time.sleep(wait + 1)
            else:
                raise


def generate_post(topic: str, api_key: str, date_override: str | None = None) -> str:
    """
    Generate a completely original Jekyll blog post on the given topic.
    Uses GENERATE_SYSTEM_PROMPT to write fresh Apostolic/Pentecostal content.
    """
    today = date_override or datetime.now().strftime("%Y-%m-%d")
    client = genai.Client(api_key=api_key)
    user_message = (
        f"Today's date is {today}.\n\n"
        f"Write an original Jekyll blog post about the following:\n\n"
        f"{topic}"
    )

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=TEXT_MODEL,
                contents=user_message,
                config=genai_types.GenerateContentConfig(
                    system_instruction=GENERATE_SYSTEM_PROMPT,
                    temperature=0.8,
                ),
            )
            return _sanitize_tags(_sanitize_title(_clean_response(response.text.strip())))
        except Exception as exc:
            msg = str(exc)
            if "429" in msg and attempt < 2:
                m = re.search(r"retry in ([\d.]+)s", msg)
                wait = float(m.group(1)) if m else 20.0
                time.sleep(wait + 1)
            else:
                raise


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TARGET_W, TARGET_H = 1366, 768  # final thumbnail dimensions


def generate_thumbnail(title: str, description: str, api_key: str, tags: str = "") -> bytes:
    """
    Generate a 1366x768 JPEG thumbnail for a blog post using Imagen 4.
    The image is crafted around the post's specific title, message, and themes.
    Returns raw JPEG bytes ready to commit to GitHub.
    """
    # Build a rich, topic-specific scene description
    subject_hint = f"Tags/themes: {tags}. " if tags else ""
    prompt = (
        f"Cinematic photorealistic digital painting created specifically for a Christian "
        f"blog post titled: '{title}'. "
        f"Core message: {description}. "
        f"{subject_hint}"
        f"Visually represent the central theme of '{title}' with concrete, evocative imagery: "
        f"for example, if the topic is baptism, show rushing water and light; "
        f"if it is the Holy Ghost, show flames or a rushing wind; "
        f"if it is prayer, show hands raised in worship; "
        f"if it is salvation, show an open Bible with golden rays; "
        f"if it is end times, show a dramatic sky and a trumpet. "
        f"Always match the visual to the specific topic above. "
        "Wide 16:9 landscape composition, warm golden and deep celestial blue tones, "
        "dramatic God-rays and atmospheric depth, painterly yet photorealistic, "
        "NO text, NO letters, NO words, NO signs anywhere in the image, "
        "suitable for an Apostolic Pentecostal church blog."
    )

    client = genai.Client(api_key=api_key)
    for attempt in range(3):
        try:
            response = client.models.generate_images(
                model=IMAGE_MODEL,
                prompt=prompt,
                config=genai_types.GenerateImagesConfig(
                    number_of_images=1,
                    output_mime_type="image/jpeg",
                    aspect_ratio="16:9",
                ),
            )
            raw_bytes = response.generated_images[0].image.image_bytes

            # Resize exactly to 1366x768
            img = Image.open(BytesIO(raw_bytes)).convert("RGB")
            img = img.resize((TARGET_W, TARGET_H), Image.LANCZOS)
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=90, optimize=True)
            return buf.getvalue()

        except Exception as exc:
            msg = str(exc)
            if "429" in msg and attempt < 2:
                m = re.search(r"retry in ([\d.]+)s", msg)
                wait = float(m.group(1)) if m else 20.0
                time.sleep(wait + 1)
            else:
                raise


def extract_frontmatter_value(post: str, key: str) -> str:
    """Return the scalar value for a given YAML frontmatter key."""
    pattern = rf'^{re.escape(key)}:\s*["\']?(.+?)["\']?\s*$'
    match = re.search(pattern, post, re.MULTILINE)
    return match.group(1).strip().strip("\"'") if match else ""


def make_filename(title: str, date: str) -> str:
    """
    Build a Jekyll-compatible filename from a post title and date.
    Example: "The Power of Pentecost" + "2025-06-08" → "2025-06-08-the-power-of-pentecost.md"
    """
    slug = title.lower()
    # Normalize unicode (strip accents)
    slug = unicodedata.normalize("NFKD", slug).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return f"{date}-{slug}.md"


def post_web_url(date: str, filename: str, base_url: str = "https://blog.giftpasay.com") -> str:
    """
    Build the public URL for a published Jekyll post.
    Jekyll's default permalink: /:year/:month/:day/:slug/
    """
    parts = date.split("-")  # ["2025", "06", "08"]
    slug = filename[len(date) + 1 : -len(".md")]  # strip date prefix + extension
    return f"{base_url}/{'/'.join(parts)}/{slug}/"
