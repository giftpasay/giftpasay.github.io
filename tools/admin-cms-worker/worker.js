const GITHUB_API = 'https://api.github.com';
const SESSION_COOKIE = '__Host-gift_cms_session';
const STATE_COOKIE = '__Host-gift_cms_state';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return corsPreflight(request, env);

      const url = new URL(request.url);

      if (url.pathname === '/auth/login' && request.method === 'GET') {
        return handleLogin(request, env);
      }
      if (url.pathname === '/auth/callback' && request.method === 'GET') {
        return handleCallback(request, env);
      }
      if (url.pathname === '/auth/logout' && request.method === 'POST') {
        return withCors(json({ ok: true }, 200, clearCookie(request, SESSION_COOKIE)), request, env);
      }

      if (url.pathname.startsWith('/api/')) {
        const session = await requireSession(request, env);
        await requireRepoWriteAccess(session.token, session.login, env);

        if (url.pathname === '/api/me' && request.method === 'GET') {
          const permission = await getRepoPermission(session.token, session.login, env);
          return withCors(json({ user: publicUser(session), permission }, 200), request, env);
        }

        if (url.pathname === '/api/articles' && request.method === 'GET') {
          const status = url.searchParams.get('status') || 'all';
          const articles = await listArticles(session.token, env, status);
          return withCors(json(articles, 200), request, env);
        }

        if (url.pathname.startsWith('/api/articles/') && request.method === 'GET') {
          const path = normalizeArticlePath(decodeURIComponent(url.pathname.replace('/api/articles/', '')));
          const article = await getArticle(session.token, env, path);
          return withCors(json(article, 200), request, env);
        }

        if (url.pathname === '/api/articles/draft' && request.method === 'POST') {
          const payload = await request.json();
          const result = await saveDraft(session.token, env, payload);
          return withCors(json(result, 200), request, env);
        }

        if (url.pathname === '/api/articles/publish' && request.method === 'POST') {
          const payload = await request.json();
          const result = await publishArticle(session.token, env, payload);
          return withCors(json(result, 200), request, env);
        }

        if (url.pathname.startsWith('/api/articles/') && request.method === 'DELETE') {
          const path = normalizeArticlePath(decodeURIComponent(url.pathname.replace('/api/articles/', '')));
          await deleteRepoFile(session.token, env, path, `cms: delete ${path}`);
          return withCors(json({ ok: true }, 200), request, env);
        }

        if (url.pathname === '/api/media' && request.method === 'POST') {
          const payload = await request.json();
          const result = await uploadMedia(session.token, env, payload);
          return withCors(json(result, 200), request, env);
        }
      }

      if (request.method === 'GET' && isAdminAssetPath(url.pathname)) {
        return proxyPublicAdminAsset(request, env);
      }

      return withCors(json({ error: 'Not found' }, 404), request, env);
    } catch (error) {
      const status = error.status || 500;
      const message = status === 500 ? 'Unexpected CMS API error' : error.message;
      return withCors(json({ error: message }, status), request, env);
    }
  },
};

async function proxyPublicAdminAsset(request, env) {
  const sourceOrigin = env.PUBLIC_SITE_ORIGIN || env.CMS_ORIGIN || 'https://blog.giftpasay.com';
  const url = new URL(request.url);

  if (url.pathname === '/admin-cms') {
    url.pathname = '/admin-cms/';
    return redirect(url.toString());
  }

  const sourceUrl = new URL(url.pathname + url.search, sourceOrigin);
  const response = await fetch(sourceUrl.toString(), {
    headers: {
      Accept: request.headers.get('Accept') || '*/*',
      'User-Agent': 'giftpasay-admin-cms-worker',
    },
  });

  if (!response.ok) return response;

  const headers = new Headers(response.headers);
  headers.delete('content-security-policy');
  headers.delete('x-frame-options');
  headers.set('Cache-Control', url.pathname.endsWith('/config.js') ? 'no-store' : 'public, max-age=300');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function isAdminAssetPath(pathname) {
  return (
    pathname === '/admin-cms' ||
    pathname.startsWith('/admin-cms/') ||
    pathname.startsWith('/assets/img/') ||
    pathname.startsWith('/assets/bibles/')
  );
}

async function handleLogin(request, env) {
  assertEnv(env, ['GH_CLIENT_ID', 'SESSION_SECRET']);
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const returnTo = safeAdminReturnUrl(url.searchParams.get('returnTo') || request.headers.get('Referer'), env);
  const callbackUrl = env.OAUTH_CALLBACK_URL || `${new URL(request.url).origin}/auth/callback`;
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', env.GH_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('scope', env.GITHUB_OAUTH_SCOPES || 'public_repo');
  authUrl.searchParams.set('state', state);

  const cookie = await encryptedCookie(request, env, STATE_COOKIE, { state, returnTo, createdAt: Date.now() }, 600);
  return redirect(authUrl.toString(), cookie);
}

async function handleCallback(request, env) {
  assertEnv(env, ['GH_CLIENT_ID', 'GH_CLIENT_SECRET', 'SESSION_SECRET']);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) throw httpError(400, 'Missing OAuth code or state');

  const savedState = await readEncryptedCookie(request, env, STATE_COOKIE);
  if (!savedState || savedState.state !== state) throw httpError(400, 'OAuth state mismatch');

  const tokenData = await exchangeCodeForToken(code, request, env);
  const user = await github(tokenData.access_token, '/user');
  await requireRepoWriteAccess(tokenData.access_token, user.login, env);

  const sessionCookie = await encryptedCookie(
    request,
    env,
    SESSION_COOKIE,
    {
      token: tokenData.access_token,
      login: user.login,
      name: user.name || user.login,
      avatarUrl: user.avatar_url || '',
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    },
    SESSION_TTL_SECONDS,
  );

  const successUrl =
    savedState.returnTo || env.OAUTH_SUCCESS_URL || `${env.CMS_ORIGIN || 'https://blog.giftpasay.com'}/admin-cms/`;
  return redirect(successUrl, [sessionCookie, clearCookie(request, STATE_COOKIE)]);
}

async function exchangeCodeForToken(code, request, env) {
  const callbackUrl = env.OAUTH_CALLBACK_URL || `${new URL(request.url).origin}/auth/callback`;
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'giftpasay-admin-cms',
    },
    body: JSON.stringify({
      client_id: env.GH_CLIENT_ID,
      client_secret: env.GH_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw httpError(401, data.error_description || 'GitHub OAuth token exchange failed');
  }
  return data;
}

async function requireSession(request, env) {
  const session = await readEncryptedCookie(request, env, SESSION_COOKIE);
  if (!session || !session.token || !session.login) throw httpError(401, 'Not signed in');
  if (session.exp && session.exp < Math.floor(Date.now() / 1000)) throw httpError(401, 'Session expired');
  return session;
}

function publicUser(session) {
  return {
    login: session.login,
    name: session.name,
    avatarUrl: session.avatarUrl,
  };
}

async function requireRepoWriteAccess(token, login, env) {
  const allowed = parseCsv(env.ADMIN_GITHUB_LOGINS);
  if (allowed.length && !allowed.includes(login.toLowerCase())) {
    throw httpError(403, 'GitHub user is not in ADMIN_GITHUB_LOGINS');
  }

  const permission = await getRepoPermission(token, login, env);
  if (!['admin', 'maintain', 'write'].includes(permission)) {
    throw httpError(403, 'GitHub user does not have repository write access');
  }
}

async function getRepoPermission(token, login, env) {
  const owner = env.REPO_OWNER || 'giftpasay';
  const repo = env.REPO_NAME || 'giftpasay.github.io';
  const data = await github(token, `/repos/${owner}/${repo}/collaborators/${login}/permission`);
  return data.permission;
}

async function listArticles(token, env, status) {
  const wantsDrafts = status === 'all' || status === 'draft';
  const wantsPublished = status === 'all' || status === 'published';
  const articles = [];

  if (wantsDrafts) {
    articles.push(...(await listFolderArticles(token, env, '_drafts', 'draft')));
  }
  if (wantsPublished) {
    articles.push(...(await listFolderArticles(token, env, '_posts', 'published')));
  }

  return articles.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

async function listFolderArticles(token, env, folder, status) {
  let files = [];
  try {
    files = await github(token, repoPath(env, `/contents/${folder}?ref=${encodeURIComponent(branch(env))}`));
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }

  const markdownFiles = files.filter((file) => file.type === 'file' && file.name.endsWith('.md'));
  const articles = await Promise.all(
    markdownFiles.map(async (file) => {
      try {
        const full = await getArticle(token, env, file.path);
        return summarizeArticle(full, status);
      } catch (_) {
        return {
          status,
          path: file.path,
          title: titleFromPath(file.path),
          date: dateFromPath(file.path),
          description: '',
          pin: false,
        };
      }
    }),
  );

  return articles;
}

function summarizeArticle(article, status) {
  return {
    status,
    path: article.path,
    title: displayTitle(article.title || titleFromPath(article.path)),
    date: article.date || dateFromPath(article.path),
    description: article.description || excerptFromMarkdown(article.body),
    categories: article.categories || [],
    tags: article.tags || [],
    image: article.image || '',
    pin: Boolean(article.pin),
    slug: article.slug,
  };
}

async function getArticle(token, env, path) {
  path = normalizeArticlePath(path);
  const file = await getRepoFile(token, env, path);
  const parsed = parsePost(file.content);
  return {
    ...parsed,
    path,
    sha: file.sha,
    status: path.startsWith('_drafts/') ? 'draft' : 'published',
    date: parsed.date || dateFromPath(path),
    slug: parsed.slug || slugFromPath(path),
  };
}

async function saveDraft(token, env, payload) {
  const article = normalizePayload(payload);
  const originalPath = optionalArticlePath(payload.originalPath);
  const path = `_drafts/${article.slug}.md`;
  const content = serializePost(article);
  await putRepoFile(token, env, path, content, `cms: save draft ${article.slug}.md`);

  if (originalPath && originalPath.startsWith('_posts/') && originalPath !== path) {
    await deleteRepoFile(token, env, originalPath, `cms: move published post to draft ${originalPath}`).catch(
      () => null,
    );
  }

  return {
    ok: true,
    article: {
      ...article,
      path,
      status: 'draft',
    },
  };
}

async function publishArticle(token, env, payload) {
  const article = normalizePayload(payload);
  const originalPath = optionalArticlePath(payload.originalPath);
  const path = `_posts/${article.date}-${article.slug}.md`;
  const content = serializePost(article);
  await putRepoFile(token, env, path, content, `cms: publish ${article.date}-${article.slug}.md`);

  if (originalPath && originalPath !== path) {
    const message = originalPath.startsWith('_drafts/')
      ? `cms: remove draft ${originalPath}`
      : `cms: replace published post ${originalPath}`;
    await deleteRepoFile(token, env, originalPath, message).catch(() => null);
  }

  return {
    ok: true,
    article: {
      ...article,
      path,
      status: 'published',
    },
  };
}

async function uploadMedia(token, env, payload) {
  if (!payload.base64) throw httpError(400, 'Missing base64 image data');
  const cleanSlug = slugify(payload.slug || 'featured-image');
  const ext = mediaExtension(payload.fileName, payload.mimeType);
  const path = `assets/img/thumbnails/${cleanSlug}-${Date.now()}.${ext}`;
  await putRepoFileBase64(token, env, path, payload.base64, `cms: upload ${path}`);
  return { ok: true, path };
}

function normalizePayload(payload) {
  const title = String(payload.title || 'Untitled article').trim();
  const slug = slugify(payload.slug || title);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(payload.date || '') ? payload.date : new Date().toISOString().slice(0, 10);
  const categories = Array.isArray(payload.categories) && payload.categories.length ? payload.categories : ['Sermon Notes'];
  const tags = Array.isArray(payload.tags) ? payload.tags : [];

  return {
    title,
    date,
    categories: categories.map((value) => String(value).trim()).filter(Boolean),
    tags: tags.map((value) => String(value).trim().toLowerCase()).filter(Boolean),
    description: String(payload.description || '').trim(),
    image: String(payload.image || '').trim(),
    comments: Boolean(payload.comments),
    pin: Boolean(payload.pin),
    slug,
    body: String(payload.body || '').trim(),
  };
}

function optionalArticlePath(path) {
  if (!path) return '';
  return normalizeArticlePath(path);
}

function normalizeArticlePath(path) {
  const clean = String(path || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();

  if (!/^_(posts|drafts)\/[^/]+\.md$/.test(clean)) {
    throw httpError(400, 'Invalid article path');
  }

  return clean;
}

function serializePost(article) {
  const lines = [
    '---',
    `title: ${yamlString(article.title)}`,
    `date: ${article.date}`,
    `categories: [${article.categories.map(yamlString).join(', ')}]`,
    `tags: [${article.tags.map(yamlString).join(', ')}]`,
    `description: ${yamlString(article.description)}`,
    article.image ? `image: ${yamlString(article.image)}` : 'image:',
    `comments: ${article.comments ? 'true' : 'false'}`,
    `pin: ${article.pin ? 'true' : 'false'}`,
    '---',
    '',
    article.body || '',
    '',
  ];
  return lines.join('\n');
}

function parsePost(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return {
      title: '',
      date: '',
      categories: [],
      tags: [],
      description: '',
      image: '',
      comments: false,
      pin: false,
      body: content,
    };
  }

  const frontmatter = match[1];
  const body = match[2].trim();
  return {
    title: readScalar(frontmatter, 'title'),
    date: readScalar(frontmatter, 'date').slice(0, 10),
    categories: readArray(frontmatter, 'categories'),
    tags: readArray(frontmatter, 'tags'),
    description: readScalar(frontmatter, 'description'),
    image: readScalar(frontmatter, 'image'),
    comments: readScalar(frontmatter, 'comments') === 'true',
    pin: readScalar(frontmatter, 'pin') === 'true',
    body,
  };
}

function readScalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${escapeRegExp(key)}:[ \\t]*(.*)$`, 'm'));
  if (!match) return '';
  return unquoteYaml(match[1].trim());
}

function readArray(frontmatter, key) {
  const value = readScalar(frontmatter, key);
  if (!value) return [];
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => unquoteYaml(item.trim()))
      .filter(Boolean);
  }
  return [value];
}

async function getRepoFile(token, env, path) {
  const data = await github(token, repoPath(env, `/contents/${encodePath(path)}?ref=${encodeURIComponent(branch(env))}`));
  return {
    sha: data.sha,
    content: decodeBase64Utf8(data.content || ''),
  };
}

async function putRepoFile(token, env, path, content, message) {
  const encoded = encodeBase64Utf8(content);
  return putRepoFileBase64(token, env, path, encoded, message);
}

async function putRepoFileBase64(token, env, path, base64, message) {
  let sha;
  try {
    const existing = await github(token, repoPath(env, `/contents/${encodePath(path)}?ref=${encodeURIComponent(branch(env))}`));
    sha = existing.sha;
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const body = {
    message,
    content: base64,
    branch: branch(env),
  };
  if (sha) body.sha = sha;

  return github(token, repoPath(env, `/contents/${encodePath(path)}`), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function deleteRepoFile(token, env, path, message) {
  const existing = await github(token, repoPath(env, `/contents/${encodePath(path)}?ref=${encodeURIComponent(branch(env))}`));
  return github(token, repoPath(env, `/contents/${encodePath(path)}`), {
    method: 'DELETE',
    body: JSON.stringify({
      message,
      sha: existing.sha,
      branch: branch(env),
    }),
  });
}

async function github(token, path, init = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'giftpasay-admin-cms',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      message = data.message || message;
    } catch (_) {}
    throw httpError(response.status, message);
  }

  if (response.status === 204) return null;
  return response.json();
}

function repoPath(env, suffix) {
  const owner = env.REPO_OWNER || 'giftpasay';
  const repo = env.REPO_NAME || 'giftpasay.github.io';
  return `/repos/${owner}/${repo}${suffix}`;
}

function branch(env) {
  return env.TARGET_BRANCH || 'main';
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function slugFromPath(path) {
  return path
    .split('/')
    .pop()
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .replace(/\.md$/, '');
}

function titleFromPath(path) {
  return displayTitle(slugFromPath(path).replace(/-/g, ' '));
}

function dateFromPath(path) {
  const match = String(path || '').match(/(?:^|\/)(\d{4}-\d{2}-\d{2})-/);
  return match ? match[1] : '';
}

function displayTitle(value) {
  return titleCase(stripLeadingDate(value));
}

function stripLeadingDate(value) {
  return String(value || '')
    .replace(/^\s*\d{4}[-_\s]+\d{1,2}[-_\s]+\d{1,2}[-_\s]+/, '')
    .replace(/^\s*\d{4}[-_\s]+\d{1,2}[-_\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value) {
  const keepLower = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
  return String(value || '')
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && keepLower.has(lower)) return lower;
      return lower.replace(/(^|[-'"])([a-z])/g, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
    })
    .join(' ');
}

function excerptFromMarkdown(markdown) {
  const text = String(markdown || '')
    .replace(/^---[\s\S]*?---/, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[[^\]]+]\([^)]*\)/g, (match) => match.replace(/^\[|\]\([^)]*\)$/g, ''))
    .replace(/[`*_>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 156 ? `${text.slice(0, 153).trim()}...` : text;
}

function slugify(value) {
  return String(value || 'untitled-article')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled-article';
}

function yamlString(value) {
  return JSON.stringify(String(value || ''));
}

function unquoteYaml(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function mediaExtension(fileName = '', mimeType = '') {
  const byMime = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  if (byMime[mimeType]) return byMime[mimeType];
  const ext = String(fileName).split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'jpg';
}

async function encryptedCookie(request, env, name, value, maxAge) {
  const encrypted = await encryptJson(env.SESSION_SECRET, value);
  return `${name}=${encrypted}; ${cookieAttrs(request, maxAge)}`;
}

function clearCookie(request, name) {
  return `${name}=; ${cookieAttrs(request, 0)}`;
}

function cookieAttrs(request, maxAge) {
  const isSecure = new URL(request.url).protocol === 'https:';
  const sameSite = isSecure ? 'None' : 'Lax';
  const secure = isSecure ? ' Secure;' : '';
  return `Path=/; HttpOnly;${secure} SameSite=${sameSite}; Max-Age=${maxAge}`;
}

async function readEncryptedCookie(request, env, name) {
  const cookies = parseCookie(request.headers.get('Cookie') || '');
  if (!cookies[name]) return null;
  try {
    return decryptJson(env.SESSION_SECRET, cookies[name]);
  } catch (_) {
    return null;
  }
}

function parseCookie(header) {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return [part.slice(0, index), part.slice(index + 1)];
      }),
  );
}

async function encryptJson(secret, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(secret);
  const data = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(cipher))}`;
}

async function decryptJson(secret, value) {
  const [ivPart, cipherPart] = value.split('.');
  if (!ivPart || !cipherPart) throw new Error('Invalid encrypted cookie');
  const key = await aesKey(secret);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlDecode(ivPart) },
    key,
    base64UrlDecode(cipherPart),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

async function aesKey(secret) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const clean = value.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function withCors(response, request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return response;

  if (!isAllowedOrigin(origin, env)) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Vary', appendVary(headers.get('Vary'), 'Origin'));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function corsPreflight(request, env) {
  const origin = request.headers.get('Origin');
  const headers = new Headers();
  if (origin && isAllowedOrigin(origin, env)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Access-Control-Max-Age', '86400');
  }
  return new Response(null, { status: 204, headers });
}

function allowedOrigins(env) {
  const defaults = [
    'https://blog.giftpasay.com',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ];
  return [...new Set([...parseCsv(env.CMS_ORIGIN), ...defaults].map(normalizeOrigin).filter(Boolean))];
}

function isAllowedOrigin(origin, env) {
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins(env).includes(normalized)) return true;

  try {
    const url = new URL(normalized);
    if (url.protocol === 'https:' && (url.hostname === 'giftpasay.com' || url.hostname.endsWith('.giftpasay.com'))) {
      return true;
    }
  } catch (_) {}

  return false;
}

function safeAdminReturnUrl(value, env) {
  if (!value) return '';

  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (!isAllowedOrigin(url.origin, env)) return '';
    if (path !== '/admin-cms' && !path.startsWith('/admin-cms/')) return '';
    url.hash = '';
    return url.toString();
  } catch (_) {
    return '';
  }
}

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '').toLowerCase();
}

function appendVary(current, value) {
  if (!current) return value;
  return current.includes(value) ? current : `${current}, ${value}`;
}

function json(data, status = 200, setCookie = null) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  if (setCookie) appendCookies(headers, setCookie);
  return new Response(JSON.stringify(data), { status, headers });
}

function redirect(location, setCookie) {
  const headers = new Headers({ Location: location });
  if (setCookie) appendCookies(headers, setCookie);
  return new Response(null, { status: 302, headers });
}

function appendCookies(headers, cookies) {
  const values = Array.isArray(cookies) ? cookies : [cookies];
  values.filter(Boolean).forEach((cookie) => headers.append('Set-Cookie', cookie));
}

function parseCsv(value = '') {
  return String(value)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function assertEnv(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw httpError(500, `Missing Worker config: ${missing.join(', ')}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
