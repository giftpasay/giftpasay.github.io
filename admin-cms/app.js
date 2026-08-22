(function () {
  const config = window.ADMIN_CMS_CONFIG || {};
  const apiBaseUrl = (config.apiBaseUrl || '').replace(/\/$/, '');

  const state = {
    user: null,
    articles: [],
    filter: 'all',
    current: null,
    mode: 'rich',
    preview: false,
  };

  const els = {
    screenTitle: document.getElementById('screen-title'),
    authStatus: document.getElementById('auth-status'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    authPanel: document.getElementById('auth-panel'),
    authPanelLogin: document.getElementById('auth-panel-login'),
    listView: document.getElementById('article-list-view'),
    editorView: document.getElementById('editor-view'),
    mediaView: document.getElementById('media-view'),
    articleList: document.getElementById('article-list'),
    rowTemplate: document.getElementById('article-row-template'),
    backToList: document.getElementById('back-to-list'),
    saveState: document.getElementById('save-state'),
    title: document.getElementById('title-input'),
    description: document.getElementById('description-input'),
    rich: document.getElementById('rich-editor'),
    markdown: document.getElementById('markdown-editor'),
    preview: document.getElementById('preview-pane'),
    modeToggle: document.getElementById('mode-toggle'),
    previewToggle: document.getElementById('preview-toggle'),
    publishBtn: document.getElementById('publish-btn'),
    draftBtn: document.getElementById('draft-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    statusLabel: document.getElementById('status-label'),
    date: document.getElementById('date-input'),
    category: document.getElementById('category-input'),
    tags: document.getElementById('tags-input'),
    comments: document.getElementById('comments-input'),
    imageInput: document.getElementById('image-input'),
    imagePreview: document.getElementById('image-preview'),
    imageFile: document.getElementById('image-file'),
    uploadImageBtn: document.getElementById('upload-image-btn'),
    slug: document.getElementById('slug-input'),
    urlPreview: document.getElementById('url-preview'),
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    if (!apiBaseUrl || apiBaseUrl.includes('your-admin-cms-worker')) {
      setLoggedOut('Configure admin-cms/config.js');
      els.authPanel.classList.remove('hidden');
      els.authPanel.querySelector('p').textContent =
        'Set apiBaseUrl in admin-cms/config.js to your deployed Cloudflare Worker URL.';
      return;
    }

    bindEvents();
    checkSession();
  }

  function bindEvents() {
    els.loginBtn.addEventListener('click', login);
    els.authPanelLogin.addEventListener('click', login);
    els.logoutBtn.addEventListener('click', logout);
    els.backToList.addEventListener('click', showArticles);
    els.draftBtn.addEventListener('click', () => saveArticle('draft'));
    els.publishBtn.addEventListener('click', () => saveArticle('publish'));
    els.deleteBtn.addEventListener('click', deleteArticle);
    els.modeToggle.addEventListener('click', toggleMode);
    els.previewToggle.addEventListener('click', togglePreview);
    els.uploadImageBtn.addEventListener('click', () => els.imageFile.click());
    els.imageFile.addEventListener('change', uploadImage);
    els.slug.addEventListener('input', updateUrlPreview);
    els.title.addEventListener('input', onTitleChanged);
    els.imageInput.addEventListener('input', updateImagePreview);

    document.querySelectorAll('[data-action="new"]').forEach((button) => {
      button.addEventListener('click', () => openEditor(newArticle()));
    });

    document.querySelectorAll('[data-view]').forEach((button) => {
      button.addEventListener('click', () => showView(button.dataset.view));
    });

    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.filter = button.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        renderArticles();
      });
    });

    document.querySelectorAll('[data-command]').forEach((button) => {
      button.addEventListener('click', () => runCommand(button.dataset.command));
    });
  }

  async function checkSession() {
    try {
      const me = await api('/api/me');
      state.user = me.user;
      els.authStatus.textContent = `${state.user.login} · ${me.permission}`;
      els.loginBtn.classList.add('hidden');
      els.logoutBtn.classList.remove('hidden');
      els.authPanel.classList.add('hidden');
      await loadArticles();
    } catch (error) {
      setLoggedOut(error.message || 'Not signed in');
      els.authPanel.classList.remove('hidden');
    }
  }

  function setLoggedOut(message) {
    state.user = null;
    els.authStatus.textContent = message;
    els.loginBtn.classList.remove('hidden');
    els.logoutBtn.classList.add('hidden');
  }

  function login() {
    window.location.href = `${apiBaseUrl}/auth/login`;
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => null);
    state.articles = [];
    renderArticles();
    setLoggedOut('Signed out');
    els.authPanel.classList.remove('hidden');
  }

  async function loadArticles() {
    els.articleList.innerHTML = loadingHtml('Loading articles...');
    state.articles = await api('/api/articles?status=all');
    renderArticles();
  }

  function renderArticles() {
    const list = state.articles.filter((article) => state.filter === 'all' || article.status === state.filter);
    els.articleList.innerHTML = '';

    if (!state.user) {
      els.articleList.innerHTML = loadingHtml('Sign in to load articles.');
      return;
    }

    if (!list.length) {
      els.articleList.innerHTML = loadingHtml('No articles found for this filter.');
      return;
    }

    list.forEach((article) => {
      const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
      const dot = row.querySelector('.status-dot');
      const title = row.querySelector('h2');
      const meta = row.querySelector('p');
      const button = row.querySelector('button');

      dot.classList.toggle('draft', article.status === 'draft');
      title.textContent = article.title || titleFromPath(article.path);
      meta.textContent = `${article.status.toUpperCase()} · ${article.date || 'No date'} · ${article.path}`;
      button.addEventListener('click', () => loadArticle(article.path));
      els.articleList.append(row);
    });
  }

  async function loadArticle(path) {
    setSaving('Loading article...');
    const article = await api(`/api/articles/${encodeURIComponent(path)}`);
    openEditor(article);
    setSaving('Loaded');
  }

  function openEditor(article) {
    state.current = article;
    state.mode = 'rich';
    state.preview = false;
    els.screenTitle.textContent = article.path ? 'Edit article' : 'Write new';
    showOnly(els.editorView);
    fillEditor(article);
  }

  function fillEditor(article) {
    els.title.value = article.title || '';
    els.description.value = article.description || '';
    els.date.value = article.date || today();
    els.category.value = (article.categories && article.categories[0]) || 'Sermon Notes';
    els.tags.value = (article.tags || []).join(', ');
    els.comments.checked = Boolean(article.comments);
    els.imageInput.value = article.image || '';
    els.slug.value = article.slug || slugify(article.title || 'untitled-article');
    els.markdown.value = article.body || '';
    els.rich.innerHTML = markdownToHtml(article.body || '');
    els.statusLabel.textContent = article.status || 'draft';
    els.draftBtn.textContent = article.status === 'published' ? 'Move to draft' : 'Save draft';
    updateUrlPreview();
    updateImagePreview();
    syncEditorMode();
  }

  function collectArticle() {
    const body = currentMarkdown();
    const title = els.title.value.trim() || 'Untitled article';
    const slug = slugify(els.slug.value || title);

    return {
      originalPath: state.current && state.current.path,
      title,
      date: els.date.value || today(),
      categories: [els.category.value || 'Sermon Notes'],
      tags: splitTags(els.tags.value),
      description: els.description.value.trim(),
      image: els.imageInput.value.trim(),
      comments: els.comments.checked,
      slug,
      body,
    };
  }

  async function saveArticle(kind) {
    const article = collectArticle();
    setSaving(kind === 'publish' ? 'Publishing...' : 'Saving draft...');
    const saved = await api(`/api/articles/${kind}`, {
      method: 'POST',
      body: JSON.stringify(article),
    });

    state.current = saved.article;
    fillEditor(saved.article);
    setSaving(kind === 'publish' ? 'Published' : 'Draft saved');
    await loadArticles();
  }

  async function deleteArticle() {
    if (!state.current || !state.current.path) {
      setSaving('Nothing to delete');
      return;
    }

    const confirmed = window.confirm(`Delete ${state.current.path}? This commits a delete to GitHub.`);
    if (!confirmed) return;

    setSaving('Deleting...');
    await api(`/api/articles/${encodeURIComponent(state.current.path)}`, { method: 'DELETE' });
    await loadArticles();
    showArticles();
    setSaving('Deleted');
  }

  async function uploadImage() {
    const file = els.imageFile.files && els.imageFile.files[0];
    if (!file) return;

    setSaving('Uploading image...');
    const base64 = await fileToBase64(file);
    const response = await api('/api/media', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
        slug: slugify(els.slug.value || els.title.value || file.name),
      }),
    });

    els.imageInput.value = response.path;
    updateImagePreview();
    setSaving('Image uploaded');
  }

  function showArticles() {
    els.screenTitle.textContent = 'Articles';
    showOnly(els.listView);
    renderArticles();
  }

  function showView(view) {
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`)?.classList.add('active');

    if (view === 'media') {
      els.screenTitle.textContent = 'Media';
      showOnly(els.mediaView);
    } else {
      showArticles();
    }
  }

  function showOnly(active) {
    [els.listView, els.editorView, els.mediaView].forEach((view) => view.classList.add('hidden'));
    active.classList.remove('hidden');
  }

  function toggleMode() {
    if (state.mode === 'rich') {
      els.markdown.value = htmlToMarkdown(els.rich.innerHTML);
      state.mode = 'markdown';
    } else {
      els.rich.innerHTML = markdownToHtml(els.markdown.value);
      state.mode = 'rich';
    }
    state.preview = false;
    syncEditorMode();
  }

  function togglePreview() {
    state.preview = !state.preview;
    if (state.preview) {
      els.preview.innerHTML = markdownToHtml(currentMarkdown());
    }
    syncEditorMode();
  }

  function syncEditorMode() {
    els.modeToggle.classList.toggle('active', state.mode === 'markdown');
    els.modeToggle.textContent = state.mode === 'markdown' ? 'Rich text' : 'Markdown';
    els.previewToggle.classList.toggle('active', state.preview);
    els.preview.classList.toggle('hidden', !state.preview);
    els.rich.classList.toggle('hidden', state.preview || state.mode !== 'rich');
    els.markdown.classList.toggle('hidden', state.preview || state.mode !== 'markdown');
  }

  function currentMarkdown() {
    return state.mode === 'markdown' ? els.markdown.value : htmlToMarkdown(els.rich.innerHTML);
  }

  function runCommand(command) {
    if (state.mode === 'markdown') {
      wrapMarkdown(command);
      return;
    }

    els.rich.focus();
    if (command === 'bold') document.execCommand('bold');
    if (command === 'italic') document.execCommand('italic');
    if (command === 'heading2') document.execCommand('formatBlock', false, 'h2');
    if (command === 'heading3') document.execCommand('formatBlock', false, 'h3');
    if (command === 'quote') document.execCommand('formatBlock', false, 'blockquote');
    if (command === 'ul') document.execCommand('insertUnorderedList');
    if (command === 'ol') document.execCommand('insertOrderedList');
    if (command === 'link') {
      const url = window.prompt('Enter link URL');
      if (url) document.execCommand('createLink', false, url);
    }
    if (command === 'image') {
      const url = window.prompt('Enter image URL or uploaded path');
      if (url) document.execCommand('insertImage', false, url);
    }
    if (command === 'scripture') {
      document.execCommand('insertText', false, '\n> "Scripture text..." — **Book 1:1**\n');
    }
  }

  function wrapMarkdown(command) {
    const textarea = els.markdown;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || 'text';
    const wrappers = {
      bold: [`**${selected}**`, 2],
      italic: [`_${selected}_`, 1],
      heading2: [`## ${selected}`, 3],
      heading3: [`### ${selected}`, 4],
      quote: [`> ${selected}`, 2],
      ul: [`- ${selected}`, 2],
      ol: [`1. ${selected}`, 3],
      link: [`[${selected}](https://example.com)`, 1],
      image: [`![${selected}](/assets/img/thumbnails/image.jpg)`, 2],
      scripture: [`> "${selected}" — **Book 1:1**`, 3],
    };
    const [replacement, offset] = wrappers[command] || [selected, 0];
    textarea.setRangeText(replacement, start, end, 'end');
    textarea.focus();
    textarea.selectionStart = start + offset;
  }

  function onTitleChanged() {
    if (!state.current || !state.current.path) {
      els.slug.value = slugify(els.title.value);
      updateUrlPreview();
    }
  }

  function updateUrlPreview() {
    const slug = slugify(els.slug.value || els.title.value || 'untitled-article');
    els.slug.value = slug;
    els.urlPreview.textContent = `/posts/${slug}/`;
  }

  function updateImagePreview() {
    const value = els.imageInput.value.trim();
    if (!value) {
      els.imagePreview.textContent = 'No image chosen';
      return;
    }
    const src = value.startsWith('http') || value.startsWith('/') ? value : `/${value}`;
    els.imagePreview.innerHTML = `<img src="${escapeHtml(src)}" alt="">`;
  }

  async function api(path, options = {}) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const data = await response.json();
        message = data.error || message;
      } catch (_) {
        message = await response.text();
      }
      throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  function newArticle() {
    return {
      status: 'draft',
      title: '',
      date: today(),
      categories: ['Sermon Notes'],
      tags: [],
      description: '',
      image: '',
      comments: false,
      slug: 'untitled-article',
      body: '',
    };
  }

  function loadingHtml(message) {
    return `<div class="empty-state"><p>${escapeHtml(message)}</p></div>`;
  }

  function setSaving(message) {
    els.saveState.textContent = message;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function splitTags(value) {
    return value
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }

  function slugify(value) {
    return (value || 'untitled-article')
      .toString()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled-article';
  }

  function titleFromPath(path) {
    return path
      .split('/')
      .pop()
      .replace(/^\d{4}-\d{2}-\d{2}-/, '')
      .replace(/\.md$/, '')
      .replace(/-/g, ' ');
  }

  function markdownToHtml(markdown) {
    const lines = escapeHtml(markdown || '').split('\n');
    let inList = false;
    let html = '';

    for (const line of lines) {
      if (/^###\s+/.test(line)) {
        if (inList) html += '</ul>';
        inList = false;
        html += `<h3>${inlineMarkdown(line.replace(/^###\s+/, ''))}</h3>`;
      } else if (/^##\s+/.test(line)) {
        if (inList) html += '</ul>';
        inList = false;
        html += `<h2>${inlineMarkdown(line.replace(/^##\s+/, ''))}</h2>`;
      } else if (/^>\s?/.test(line)) {
        if (inList) html += '</ul>';
        inList = false;
        html += `<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`;
      } else if (/^-\s+/.test(line)) {
        if (!inList) html += '<ul>';
        inList = true;
        html += `<li>${inlineMarkdown(line.replace(/^-\s+/, ''))}</li>`;
      } else if (line.trim() === '') {
        if (inList) html += '</ul>';
        inList = false;
      } else {
        if (inList) html += '</ul>';
        inList = false;
        html += `<p>${inlineMarkdown(line)}</p>`;
      }
    }

    if (inList) html += '</ul>';
    return html;
  }

  function inlineMarkdown(value) {
    return value
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  }

  function htmlToMarkdown(html) {
    const container = document.createElement('div');
    container.innerHTML = html || '';

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = node.tagName.toLowerCase();
      const text = Array.from(node.childNodes).map(walk).join('');

      if (tag === 'strong' || tag === 'b') return `**${text}**`;
      if (tag === 'em' || tag === 'i') return `_${text}_`;
      if (tag === 'a') return `[${text}](${node.getAttribute('href') || ''})`;
      if (tag === 'img') return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
      if (tag === 'h2') return `\n## ${text}\n`;
      if (tag === 'h3') return `\n### ${text}\n`;
      if (tag === 'blockquote') return `\n> ${text}\n`;
      if (tag === 'li') return `- ${text}\n`;
      if (tag === 'p' || tag === 'div') return `${text}\n\n`;
      return text;
    }

    return Array.from(container.childNodes)
      .map(walk)
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
})();
