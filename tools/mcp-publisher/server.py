"""
FastMCP server — Jekyll Biblical Publisher
Exposes tools that Claude (or any MCP host) can call to:
  - Preview / publish Jekyll posts from raw notes via GitHub API
  - List recent posts
  - Fetch an existing post's content

Run with:
    python server.py
Or register in mcp.json (see README).
"""

import os
from typing import Optional

from dotenv import load_dotenv
from fastmcp import FastMCP

from formatter import (
    extract_frontmatter_value,
    format_post,
    generate_thumbnail,
    make_filename,
    post_web_url,
)
from github_client import GitHubClient

load_dotenv()

mcp = FastMCP(
    name="jekyll-biblical-publisher",
    instructions=(
        "Tools for publishing Apostolic Pentecostal sermon notes and biblical content "
        "to the UPC GIFT Pasay Jekyll blog on GitHub Pages. "
        "Always call `preview_post` first to let the user review before calling `publish_post`."
    ),
)


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------

def _github() -> GitHubClient:
    return GitHubClient(
        token=os.environ["GITHUB_TOKEN"],
        owner=os.environ["GITHUB_OWNER"],
        repo=os.environ["GITHUB_REPO"],
    )


def _gemini_key() -> str:
    return os.environ["GEMINI_API_KEY"]


def _base_url() -> str:
    return os.environ.get("SITE_BASE_URL", "https://blog.giftpasay.com")


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def preview_post(
    raw_notes: str,
    image_url: Optional[str] = None,
    date_override: Optional[str] = None,
) -> str:
    """
    Format raw sermon notes or transcription into a Jekyll blog post preview
    WITHOUT publishing it. Use this to review the formatted result first.

    Args:
        raw_notes:      Raw sermon notes, transcript, or draft text.
        image_url:      Optional featured image URL (ImageKit or any CDN).
                        If omitted, a thumbnail will be auto-generated on publish.
        date_override:  Optional post date as YYYY-MM-DD. Defaults to today.

    Returns:
        Formatted Jekyll markdown (frontmatter + body).
    """
    notes = raw_notes
    if image_url:
        notes = f"Featured Image URL: {image_url}\n\n{raw_notes}"

    return format_post(notes, _gemini_key(), date_override)


@mcp.tool()
def publish_post(
    raw_notes: str,
    image_url: Optional[str] = None,
    date_override: Optional[str] = None,
    generate_thumbnail_image: bool = True,
) -> dict:
    """
    Format raw sermon notes into a Jekyll blog post AND publish it to GitHub.
    Optionally auto-generates a thumbnail with Imagen 4 and uploads it to
    assets/img/thumbnails/. The post will be live after GitHub Pages rebuilds.

    Args:
        raw_notes:                Raw sermon notes, transcript, or draft text.
        image_url:                Optional featured image URL. Skips auto-generation.
        date_override:            Optional post date as YYYY-MM-DD. Defaults to today.
        generate_thumbnail_image: Set False to skip Imagen thumbnail generation.

    Returns:
        Dict with: filename, web_url, github_url, thumbnail_path, and a content preview.
    """
    import datetime as _dt

    notes = raw_notes
    if image_url:
        notes = f"Featured Image URL: {image_url}\n\n{raw_notes}"

    formatted = format_post(notes, _gemini_key(), date_override)

    title = extract_frontmatter_value(formatted, "title")
    description = extract_frontmatter_value(formatted, "description")
    date = extract_frontmatter_value(formatted, "date") or (
        date_override or _dt.datetime.now().strftime("%Y-%m-%d")
    )

    filename = make_filename(title, date)
    slug = filename[len(date) + 1: -len(".md")]
    github = _github()

    # --- Thumbnail ---
    thumb_path: Optional[str] = image_url  # use supplied URL if given
    if not image_url and generate_thumbnail_image:
        try:
            tags = extract_frontmatter_value(formatted, "tags")
            img_bytes = generate_thumbnail(title, description, _gemini_key(), tags)
            thumb_filename = f"{slug}.jpg"
            thumb_path = github.upload_image(thumb_filename, img_bytes)
        except Exception:
            thumb_path = None  # don't block publishing if image gen fails

    # Inject image path into frontmatter if we have one and none was in the formatted post
    if thumb_path and not extract_frontmatter_value(formatted, "image"):
        formatted = formatted.replace(
            "comments: false",
            f"image: {thumb_path}\ncomments: false",
            1,
        )

    result = github.create_post(filename, formatted)
    web_url = post_web_url(date, filename, _base_url())

    return {
        "filename": filename,
        "web_url": web_url,
        "github_url": result["content"]["html_url"],
        "thumbnail_path": thumb_path,
        "preview": formatted[:600] + "\n..." if len(formatted) > 600 else formatted,
    }


@mcp.tool()
def list_recent_posts(limit: int = 10) -> list[dict]:
    """
    List the most recently published posts in _posts (newest first).

    Args:
        limit: Number of posts to return (1-30). Defaults to 10.

    Returns:
        List of dicts with filename, path, and html_url.
    """
    limit = max(1, min(limit, 30))
    return _github().list_posts(limit)


@mcp.tool()
def get_post_content(filename: str) -> dict:
    """
    Fetch the full markdown content of an existing post by its filename.

    Args:
        filename: Jekyll post filename, e.g. "2025-06-08-the-power-of-pentecost.md"

    Returns:
        Dict with filename, sha, and content (full markdown string).
    """
    return _github().get_post(filename)


if __name__ == "__main__":
    mcp.run()
