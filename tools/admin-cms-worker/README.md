# UPC GIFT Admin CMS Worker

Free-tier Cloudflare Worker API for `/admin-cms`.

It handles GitHub OAuth, keeps GitHub tokens out of the browser, and writes
Jekyll Markdown files through the GitHub Contents API.

## Cloudflare setup

1. Create a GitHub OAuth app:
   - Homepage URL: `https://blog.giftpasay.com/admin-cms/`
   - Authorization callback URL: `https://YOUR_WORKER_DOMAIN/auth/callback`
2. Create a Cloudflare Worker using `worker.js`.
3. Add these Worker variables/secrets:

| Name | Type | Value |
| --- | --- | --- |
| `GH_CLIENT_ID` | variable | GitHub OAuth client ID |
| `GH_CLIENT_SECRET` | secret | GitHub OAuth client secret |
| `SESSION_SECRET` | secret | Random 32+ character string |
| `REPO_OWNER` | variable | `giftpasay` |
| `REPO_NAME` | variable | `giftpasay.github.io` |
| `TARGET_BRANCH` | variable | `main` |
| `ADMIN_GITHUB_LOGINS` | variable | Comma-separated allowed GitHub usernames |
| `CMS_ORIGIN` | variable | `https://blog.giftpasay.com` |
| `OAUTH_CALLBACK_URL` | variable | `https://YOUR_WORKER_DOMAIN/auth/callback` |
| `OAUTH_SUCCESS_URL` | variable | `https://blog.giftpasay.com/admin-cms/` |

`GH_CLIENT_SECRET` and `SESSION_SECRET` must be stored as Cloudflare secrets,
not committed into the repo.

## Local admin UI config

Edit `admin-cms/config.js` after deploying the Worker:

```js
window.ADMIN_CMS_CONFIG = {
  apiBaseUrl: 'https://YOUR_WORKER_DOMAIN',
  siteUrl: 'https://blog.giftpasay.com',
  repoLabel: 'giftpasay/giftpasay.github.io',
};
```

## Free services only

This implementation uses only GitHub Pages, GitHub OAuth/API, and Cloudflare
Workers free-tier capabilities. It does not require KV, D1, R2, a paid CMS, or a
database.
