# CLAUDE.md

Guidance for Claude Code working in this repository.

> This file is not referenced by the site. Jekyll copies it into `_site` (it is not in
> the `exclude` list in `_config.yml`) — harmless, but be aware it is published.

## What this repo is

The website for **United Pentecostal Church Philippines — Grace In-Christ Fellowship
Temple (GIFT) Pasay**. Live at **https://blog.giftpasay.com** (see `CNAME`).

- Jekyll 4.4 with the gem-based theme **`jekyll-theme-chirpy`** (`~> 7.2`, resolves to 7.3.0)
- Scaffolded from `cotes2020/chirpy-starter`; upstream is still a git remote named `chirpy`
- Content is mostly English, with a handful of Tagalog posts
- Local layouts/includes/sass **override** the theme gem's. Anything not present locally
  comes from the gem, so a "missing" layout is usually not missing.

## The four parts

| Part | Path | Stack |
|---|---|---|
| Static site | repo root, `_posts/`, `_layouts/`, `_includes/`, `_sass/`, `_tabs/`, `_hidden/`, `_plugins/` | Jekyll 4.4 + Chirpy |
| Browser CMS | `admin-cms/` | Vanilla HTML/CSS + one ~2.1k-line IIFE. No framework, no build |
| CMS backend | `tools/admin-cms-worker/` | Cloudflare Worker, single ESM file, zero deps |
| AI publisher | `tools/mcp-publisher/` | Python: FastMCP server + Telegram bot + Gemini/Imagen |

**There is no `package.json` anywhere in this repo and no JS build step.** Chirpy ships
prebuilt `assets/js/dist/*` (gitignored). Everything in `assets/css/` and `assets/js/` is
hand-written plain CSS/JS loaded by ordinary `<link>` / `<script>` tags.

## Three ways a post reaches `_posts/` — read this first

All three commit Markdown to `main`; GitHub Actions then rebuilds the site. **Git is the
CMS.** There is no database, no Cloudflare KV/D1/R2, no headless CMS. Nothing else is a
source of truth.

1. **Hand-edit** a file in `_posts/` and push.

2. **admin-cms** — `admin-cms/app.js` to the Worker to the GitHub Contents API.
   - Draft goes to `_drafts/<slug>.md` (`worker.js:259`, `saveDraft`)
   - Publish goes to `_posts/<YYYY-MM-DD>-<slug>.md` (`worker.js:281`, `publishArticle`)
   - Image goes to `assets/img/thumbnails/<slug>-<timestamp>.<ext>` (`worker.js:304`, `uploadMedia`)
   - Commit messages are prefixed **`cms:`**

3. **mcp-publisher** — `tools/mcp-publisher/`.
   - MCP tools: `preview_post`, `publish_post`, `list_recent_posts`, `get_post_content`
     (`server.py:64-186`). The server instructs hosts to always `preview_post` before
     `publish_post`.
   - A Telegram bot (`bot.py`) shares the same `formatter.py` and `github_client.py`.
   - Commit messages are suffixed **`via Telegram bot`** (`github_client.py:25`)
   - `create_post` sends no `sha`, so it can **create but never overwrite** a post.

### Two collision risks between publishers

- **Branch targeting differs.** The Worker writes to `TARGET_BRANCH` (`main`).
  `github_client.py` has no branch parameter and always hits the repo default branch.
- **Front matter is authored in two places.** The Worker's `serializePost`
  (`worker.js:334`) and the Gemini prompt in `formatter.py` each generate front matter
  independently. Change the front-matter shape and you must change both.

## Auth model (Worker)

GitHub OAuth, server-side only. **No passwords, no JWT, and no GitHub token ever reaches
the browser.**

- Session is an AES-GCM-encrypted `__Host-gift_cms_session` cookie, 8h TTL
  (`worker.js:4`). Key is a SHA-256 digest of `SESSION_SECRET` (`worker.js:642`, `aesKey`).
- Browser-side auth is nothing more than `credentials: 'include'` (`app.js:1261`).
  There is no `Authorization` header anywhere in `app.js`.
- Every `/api/*` request runs **both** `requireSession` (`worker.js:151`) and
  `requireRepoWriteAccess` (`worker.js:166`) — the `ADMIN_GITHUB_LOGINS` allow-list *plus*
  a live GitHub collaborator-permission check. Each API call therefore costs an extra
  GitHub round-trip.
- CORS allow-list: `CMS_ORIGIN`, any `https://*.giftpasay.com`, and localhost 4000/5500/8080.

Endpoint table, required vars, and OAuth app setup live in
**`tools/admin-cms-worker/README.md`** (env var table at lines 16-30). Deploy config:
`tools/admin-cms-worker/wrangler.jsonc` (worker name `giftpasay-admin-cms`). Client
config: `admin-cms/config.js` — only `apiBaseUrl`, `siteUrl`, `repoLabel`.

## Build and deploy

One workflow: `.github/workflows/pages-deploy.yml`. Push to `main`, then Ruby 3.3,
`bundle exec jekyll b` with `JEKYLL_ENV=production`, `htmlproofer --disable-external`,
`upload-pages-artifact@v3`, `deploy-pages@v4`.

Three non-obvious dependencies:

- **`fetch-depth: 0` is required.** `_plugins/posts-lastmod-hook.rb` shells out to
  `git log` / `git rev-list` to set `last_modified_at`. A shallow clone silently breaks it.
- **Custom `_plugins/*.rb` run only because CI builds explicitly.** Under the legacy
  GitHub Pages safe-mode build they would be ignored.
- **`htmlproofer` is a real gate**, not advisory. A broken internal link fails the deploy.

Local dev: `./tools/run.sh` (serve) and `./tools/test.sh` (production build + proof); both
are wired as VS Code tasks. `Gemfile.lock` is gitignored, so CI resolves dependencies
fresh each run. `assets/lib` is a declared-but-uninitialized submodule, consistent with
`assets.self_host.enabled` being empty — Chirpy's static assets load from CDN.

Production-only behaviour: PWA registration, GA4 + GoatCounter analytics, `compress_html`.

## Content conventions (derived from the 80 existing posts)

- Filename `YYYY-MM-DD-kebab-slug.md`. Permalink `/posts/:title/` (`_config.yml:188`).
- Front matter actually used: `title`, `date`, `comments: false` (near-universal, and it
  overrides the `true` default in `_config.yml`), `categories`, `tags` (lowercase),
  `image`, `description`, `pin`.
- **Never hand-authored:** `last_modified_at` (plugin-injected), `layout`, `author`, `toc`,
  `media_subpath`, `math`, `mermaid`.
- Dominant categories: `[Sermon Notes]` (~40), `[Bible Study]` (~15), `[Theology, ...]`.
- Body style: `##` section headings, `>` blockquotes for scripture, `---` rules between
  sections, and an italic byline block (`_Service: ..._` / `_Speaker: ..._`) near the top
  of sermon notes.
- Collections: `tabs` (output, sorted by `order`) and `hidden` (`output: false` — Tagalog
  articles reachable only via `secret-access.html`).
- `_layouts/about.html` (501 lines) and `events.html` are **standalone full-HTML pages**
  that bypass the Chirpy shell entirely. `events.html` has no front matter at all and is
  copied through as a static file.
- A `biblical-content-rewriter` skill exists under `.claude/skills/` for rewriting this
  content — prefer it over ad-hoc editing of devotional or sermon prose.

## Scripture-autolink (feature in flight)

`assets/js/scripture-autolink.js` plus `assets/css/scripture-autolink.css`:

- Turns plain references like "John 3:16" in post bodies into a tappable modal that reads
  from two local XML Bibles: `assets/bibles/kjv/king-james-version.xml` and
  `assets/bibles/tgl/ang-dating-biblia.xml` (~10.7 MB combined).
- Hydrates authored `<div class="bible-insert" data-reference data-mode data-translation>`
  blocks, where `mode` is `quote` or `comparison`.
- The CMS persists that `bible-insert` div **into the Markdown body**, so the site-side JS
  is what renders it for readers. Both halves must agree on the attribute contract.
- **The 66-book alias table (including Tagalog and Spanish forms: `mateo`, `gawa`,
  `efeso`, `apocalipsis`) is duplicated** in `assets/js/scripture-autolink.js` and
  `admin-cms/app.js:12`. Editing one means editing the other.
- Assets are cache-busted by query string (`?v=YYYYMMDD-N`) in `_layouts/post.html`.

## Known issues — documented, not fixed

Do not "fix" these as a side effect of unrelated work; raise them instead.

1. **`admin-cms/` is publicly served.** The `exclude` list at `_config.yml:212-221` names
   `tools` but not `admin-cms/`, so the CMS UI is built into `_site` and reachable at
   `blog.giftpasay.com/admin-cms/`. It is `noindex, nofollow` and holds no secrets, but it
   is live.
2. **Dead translation-widget code.** `_includes/translation-widget.html` and
   `assets/css/translation-widget.css` are tracked but orphaned — the working-tree edit to
   `_layouts/post.html` removed the only `include` and the only `link` to them.
3. **Scripture-autolink is untracked.** `assets/js/`, `assets/css/scripture-autolink.css`
   and `assets/bibles/` are untracked while the *modified* `_layouts/post.html` references
   them. A deploy of `main` as currently committed would 404 the feature.
4. **Domain values are inconsistent.** `_config.yml` and `CNAME` say
   `blog.giftpasay.com`; `_includes/head.html` (about branch), `_layouts/privacy.html`,
   and `events.html` hard-code `giftpasay.com`.
5. **Firebase config is committed and served.** `events.html:96-103` (project
   `church-admin-43072`). Firebase web keys are public by design, but Firestore security
   rules are the only access control here.
6. **Telegram bot is open by default.** `bot.py:101-105` returns `True` for every user
   when `ALLOWED_TELEGRAM_IDS` is unset.
7. **AdSense contradiction.** `_layouts/privacy.html` states the site does not use
   AdSense, while `_includes/head.html` loads `adsbygoogle` unconditionally and `ads.txt`
   declares publisher `pub-3018838403430263`.
8. **Two malformed post filenames.** `2025-06-18-ang-pananampalatayang nagliligtas.md`
   (literal space) and `2025-10-5-wherefore-remember.md` (single-digit day), both in
   `_posts/`.

## Secrets

- `tools/mcp-publisher/.env` (gitignored) holds a **live GitHub PAT, Gemini API key, and
  Telegram bot token**. Both `server.py:28` and `bot.py` call `load_dotenv()`, so that
  file wins at runtime even when `.vscode/mcp.json` supplies `${env:...}` values.
- Worker secrets (`GH_CLIENT_SECRET`, `SESSION_SECRET`) live in Cloudflare only.
  `worker.js` contains no credentials.
- **Never print, echo, or commit these values.** `.gitignore` covers `.env`,
  `tools/**/.env*`, `.dev.vars`, and `.wrangler/`.

## Working notes

- **Current branch is `main`.** The other local branches (`2.0`, `blog`, `landing`,
  `landingpage`, `overrides`, `parallax`, `refactor`, `seo`, `theme`, `translation`) are
  historical. `2.0` differs from `main` only in `.gitignore` and a deleted draft.
- **The working tree is dirty** across `_layouts/post.html`, `admin-cms/*`, and
  `tools/admin-cms-worker/worker.js`. Run `git status` before assuming committed state
  matches disk.
- `.editorconfig`: UTF-8, 2-space indent, LF, final newline. Single quotes in js/css/scss,
  double in yml. Trailing whitespace is preserved in Markdown, where it is meaningful.
- **`admin-cms/styles.css` has no comments and no section headers.** It is organized
  *positionally* to mirror the DOM order of `index.html`. Design tokens sit at lines 1-18
  (`--ink`, `--surface`, `--accent`, `--gold`, and so on); there are no spacing, radius, or
  z-index tokens. Four mobile-down breakpoints: 1100px, 721-900px, 720px, 420px. Light
  theme only, no dark mode. To edit, find the region by DOM position, not by name.
- **`admin-cms/app.js` is deliberately dependency-free.** Rich text uses the deprecated
  `document.execCommand` family; Markdown conversion is hand-rolled regex
  (`markdownToHtml` at line 1630, `htmlToMarkdown` at 1801); escaping is string-based
  (`escapeHtml` at 2061 does not escape `'`). Match this style rather than introducing a
  library.
- Article-list caching is `localStorage` with a 10-minute TTL and **no revalidation on
  cache hit** — a stale list after an external commit is expected, not a bug.
