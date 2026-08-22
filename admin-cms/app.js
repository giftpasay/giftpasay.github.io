(function () {
  const config = window.ADMIN_CMS_CONFIG || {};
  const apiBaseUrl = (config.apiBaseUrl || '').replace(/\/$/, '');
  const siteUrl = (config.siteUrl || 'https://blog.giftpasay.com').replace(/\/$/, '');
  const CACHE_PREFIX = 'gift-admin-cms';
  const ARTICLE_LIST_CACHE_KEY = `${CACHE_PREFIX}:articles:v2`;
  const ARTICLE_DETAIL_CACHE_PREFIX = `${CACHE_PREFIX}:article:v2:`;
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const BIBLE_SOURCES = {
    kjv: '/assets/bibles/kjv/king-james-version.xml',
    tgl: '/assets/bibles/tgl/ang-dating-biblia.xml',
  };
  const BIBLE_ALIASES = [
    ['Genesis', 'genesis', 'gen'],
    ['Exodus', 'exodus', 'exod', 'exo', 'ex'],
    ['Leviticus', 'leviticus', 'lev'],
    ['Numbers', 'numbers', 'num', 'nm'],
    ['Deuteronomy', 'deuteronomy', 'deut', 'dt'],
    ['Joshua', 'joshua', 'josh'],
    ['Judges', 'judges', 'judg', 'jdg'],
    ['Ruth', 'ruth'],
    ['1 Samuel', '1 samuel', '1samuel', '1 sam', '1sam', 'i samuel', 'i sam'],
    ['2 Samuel', '2 samuel', '2samuel', '2 sam', '2sam', 'ii samuel', 'ii sam'],
    ['1 Kings', '1 kings', '1kings', '1 king', '1king', 'i kings', 'i king'],
    ['2 Kings', '2 kings', '2kings', '2 king', '2king', 'ii kings', 'ii king'],
    ['1 Chronicles', '1 chronicles', '1chronicles', '1 chr', '1chr', 'i chronicles', 'i chr'],
    ['2 Chronicles', '2 chronicles', '2chronicles', '2 chr', '2chr', 'ii chronicles', 'ii chr'],
    ['Ezra', 'ezra'],
    ['Nehemiah', 'nehemiah', 'neh'],
    ['Esther', 'esther', 'esth'],
    ['Job', 'job'],
    ['Psalms', 'psalms', 'psalm', 'psa', 'ps'],
    ['Proverbs', 'proverbs', 'prov', 'pro'],
    ['Ecclesiastes', 'ecclesiastes', 'eccl', 'ecc'],
    ['Song of Solomon', 'song of solomon', 'song', 'sos', 'canticles'],
    ['Isaiah', 'isaiah', 'isa'],
    ['Jeremiah', 'jeremiah', 'jer'],
    ['Lamentations', 'lamentations', 'lam'],
    ['Ezekiel', 'ezekiel', 'ezek'],
    ['Daniel', 'daniel', 'dan'],
    ['Hosea', 'hosea', 'hos'],
    ['Joel', 'joel'],
    ['Amos', 'amos'],
    ['Obadiah', 'obadiah', 'obad'],
    ['Jonah', 'jonah'],
    ['Micah', 'micah', 'mic'],
    ['Nahum', 'nahum', 'nah'],
    ['Habakkuk', 'habakkuk', 'hab'],
    ['Zephaniah', 'zephaniah', 'zeph'],
    ['Haggai', 'haggai', 'hag'],
    ['Zechariah', 'zechariah', 'zech'],
    ['Malachi', 'malachi', 'mal'],
    ['Matthew', 'matthew', 'matt', 'mat', 'mateo'],
    ['Mark', 'mark', 'marcos', 'mk'],
    ['Luke', 'luke', 'lucas', 'lk'],
    ['John', 'john', 'juan', 'jn'],
    ['Acts', 'acts', 'gawa'],
    ['Romans', 'romans', 'rom'],
    ['1 Corinthians', '1 corinthians', '1corinthians', '1 cor', '1cor', 'i corinthians', 'i cor'],
    ['2 Corinthians', '2 corinthians', '2corinthians', '2 cor', '2cor', 'ii corinthians', 'ii cor'],
    ['Galatians', 'galatians', 'gal'],
    ['Ephesians', 'ephesians', 'eph', 'efeso', 'efesios'],
    ['Philippians', 'philippians', 'phil'],
    ['Colossians', 'colossians', 'col'],
    ['1 Thessalonians', '1 thessalonians', '1thessalonians', '1 thess', '1thess', 'i thessalonians', 'i thess'],
    ['2 Thessalonians', '2 thessalonians', '2thessalonians', '2 thess', '2thess', 'ii thessalonians', 'ii thess'],
    ['1 Timothy', '1 timothy', '1timothy', '1 tim', '1tim', 'i timothy', 'i tim'],
    ['2 Timothy', '2 timothy', '2timothy', '2 tim', '2tim', 'ii timothy', 'ii tim'],
    ['Titus', 'titus'],
    ['Philemon', 'philemon', 'philem'],
    ['Hebrews', 'hebrews', 'heb'],
    ['James', 'james', 'santiago', 'jas'],
    ['1 Peter', '1 peter', '1peter', '1 pet', '1pet', '1 ped', '1ped', 'i peter', 'i pet', 'i ped'],
    ['2 Peter', '2 peter', '2peter', '2 pet', '2pet', '2 ped', '2ped', 'ii peter', 'ii pet', 'ii ped'],
    ['1 John', '1 john', '1john', '1 jn', '1jn', 'i john', 'i jn'],
    ['2 John', '2 john', '2john', '2 jn', '2jn', 'ii john', 'ii jn'],
    ['3 John', '3 john', '3john', '3 jn', '3jn', 'iii john', 'iii jn'],
    ['Jude', 'jude', 'judas'],
    ['Revelation', 'revelation', 'rev', 'apocalipsis'],
  ];
  const bibleCache = {};

  const state = {
    user: null,
    articles: [],
    filter: 'all',
    query: '',
    sort: 'latest',
    page: 1,
    pageSize: 10,
    categories: [],
    tags: [],
    detailsCache: new Map(),
    detailsLoading: new Set(),
    current: null,
    mode: 'rich',
    preview: false,
    routeRestored: false,
    busy: false,
    hydrating: null,
    savedRichRange: null,
    richInsertMarkerId: '',
    savedMarkdownSelection: { start: 0, end: 0 },
  };

  const els = {
    appShell: document.getElementById('app-shell'),
    loginView: document.getElementById('login-view'),
    loginStatus: document.getElementById('login-status'),
    screenTitle: document.getElementById('screen-title'),
    authStatus: document.getElementById('auth-status'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    liveSiteLink: document.getElementById('live-site-link'),
    loginViewButton: document.getElementById('login-view-button'),
    mobileMenuToggle: document.getElementById('mobile-menu-toggle'),
    mobileMenuClose: document.getElementById('mobile-menu-close'),
    mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
    scrollTopBtn: document.getElementById('scroll-top-btn'),
    listView: document.getElementById('article-list-view'),
    editorView: document.getElementById('editor-view'),
    mediaView: document.getElementById('media-view'),
    articleList: document.getElementById('article-list'),
    backToList: document.getElementById('back-to-list'),
    toastRegion: document.getElementById('toast-region'),
    navLoader: document.getElementById('nav-loader'),
    title: document.getElementById('title-input'),
    description: document.getElementById('description-input'),
    rich: document.getElementById('rich-editor'),
    markdown: document.getElementById('markdown-editor'),
    preview: document.getElementById('preview-pane'),
    modeToggle: document.getElementById('mode-toggle'),
    previewToggle: document.getElementById('preview-toggle'),
    scripturePanel: document.getElementById('scripture-insert-panel'),
    scriptureReference: document.getElementById('scripture-reference-input'),
    scriptureMode: document.getElementById('scripture-insert-mode'),
    scriptureTranslation: document.getElementById('scripture-translation-input'),
    scriptureInsertBtn: document.getElementById('scripture-insert-btn'),
    scriptureCancelBtn: document.getElementById('scripture-cancel-btn'),
    tablePanel: document.getElementById('table-insert-panel'),
    tableColumns: document.getElementById('table-columns-input'),
    tableRows: document.getElementById('table-rows-input'),
    tableInsertBtn: document.getElementById('table-insert-btn'),
    tableCancelBtn: document.getElementById('table-cancel-btn'),
    publishBtn: document.getElementById('publish-btn'),
    draftBtn: document.getElementById('draft-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    statusLabel: document.getElementById('status-label'),
    date: document.getElementById('date-input'),
    category: document.getElementById('category-input'),
    tags: document.getElementById('tags-input'),
    comments: document.getElementById('comments-input'),
    pin: document.getElementById('pin-input'),
    imageInput: document.getElementById('image-input'),
    imagePreview: document.getElementById('image-preview'),
    imageFile: document.getElementById('image-file'),
    uploadImageBtn: document.getElementById('upload-image-btn'),
    slug: document.getElementById('slug-input'),
    urlPreview: document.getElementById('url-preview'),
    articleSearch: document.getElementById('article-search'),
    articleSort: document.getElementById('article-sort'),
    totalCount: document.getElementById('total-count'),
    publishedCount: document.getElementById('published-count'),
    draftCount: document.getElementById('draft-count'),
    categoryToggle: document.getElementById('category-toggle'),
    tagToggle: document.getElementById('tag-toggle'),
    categoryChips: document.getElementById('category-chips'),
    tagChips: document.getElementById('tag-chips'),
    imageUploadNote: document.getElementById('image-upload-note'),
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    registerServiceWorker();
    els.liveSiteLink.href = siteUrl || 'https://blog.giftpasay.com';

    if (!apiBaseUrl || apiBaseUrl.includes('your-admin-cms-worker')) {
      setLoggedOut('The admin sign-in service is not ready yet.');
      els.loginStatus.textContent = 'Ask the site manager to finish setting up admin sign-in.';
      return;
    }

    bindEvents();
    checkSession();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => null);
    });
  }

  function bindEvents() {
    els.loginBtn.addEventListener('click', login);
    els.loginViewButton.addEventListener('click', login);
    els.logoutBtn.addEventListener('click', logout);
    els.mobileMenuToggle.addEventListener('click', openMobileMenu);
    els.mobileMenuClose.addEventListener('click', closeMobileMenu);
    els.mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    els.scrollTopBtn.addEventListener('click', scrollToTop);
    els.backToList.addEventListener('click', showArticles);
    els.draftBtn.addEventListener('click', () => saveArticle('draft'));
    els.publishBtn.addEventListener('click', () => saveArticle('publish'));
    els.deleteBtn.addEventListener('click', deleteArticle);
    els.modeToggle.addEventListener('click', toggleMode);
    els.previewToggle.addEventListener('click', togglePreview);
    els.scriptureInsertBtn.addEventListener('click', insertScriptureBlock);
    els.scriptureCancelBtn.addEventListener('click', cancelInsertPanels);
    els.tableInsertBtn.addEventListener('click', insertConfiguredTable);
    els.tableCancelBtn.addEventListener('click', cancelInsertPanels);
    els.rich.addEventListener('paste', handleEditorPaste);
    els.markdown.addEventListener('paste', handleEditorPaste);
    els.rich.addEventListener('keyup', updateToolbarState);
    els.rich.addEventListener('mouseup', updateToolbarState);
    els.rich.addEventListener('input', updateToolbarState);
    els.rich.addEventListener('focus', updateToolbarState);
    els.markdown.addEventListener('focus', saveMarkdownSelection);
    els.markdown.addEventListener('keyup', updateToolbarState);
    els.markdown.addEventListener('mouseup', updateToolbarState);
    els.markdown.addEventListener('input', updateToolbarState);
    els.markdown.addEventListener('select', saveMarkdownSelection);
    document.addEventListener('selectionchange', updateToolbarState);
    window.addEventListener('popstate', restoreRoute);
    els.uploadImageBtn.addEventListener('click', () => els.imageFile.click());
    els.imageFile.addEventListener('change', uploadImage);
    els.slug.addEventListener('input', updateUrlPreview);
    els.title.addEventListener('input', onTitleChanged);
    els.imageInput.addEventListener('input', updateImagePreview);
    els.articleSearch.addEventListener('input', () => {
      state.query = els.articleSearch.value.trim().toLowerCase();
      state.page = 1;
      renderArticles();
    });
    els.articleSort.addEventListener('change', () => {
      state.sort = els.articleSort.value;
      state.page = 1;
      renderArticles();
    });
    els.tags.addEventListener('blur', () => {
      els.tags.value = normalizeTagInput(els.tags.value);
    });

    els.categoryToggle.addEventListener('click', () => toggleTaxonomyPanel('category'));
    els.tagToggle.addEventListener('click', () => toggleTaxonomyPanel('tag'));
    els.category.addEventListener('input', () => showTaxonomySuggestions('category'));
    els.tags.addEventListener('input', () => showTaxonomySuggestions('tag'));
    els.category.addEventListener('keydown', (event) => handleTokenKeydown(event, 'category'));
    els.tags.addEventListener('keydown', (event) => handleTokenKeydown(event, 'tag'));

    document.querySelectorAll('[data-action="new"]').forEach((button) => {
      button.addEventListener('click', () => {
        closeMobileMenu();
        // Only the sidebar entry gets the loader; the in-page "New article"
        // button sits in the view it is already looking at.
        if (button.classList.contains('nav-item')) {
          withNavLoader(async () => openEditor(newArticle()));
          return;
        }
        openEditor(newArticle());
      });
    });

    document.querySelectorAll('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        closeMobileMenu();
        withNavLoader(async () => {
          showView(button.dataset.view);
          // Articles renders from cache, then lazily fills summaries and
          // categories. Wait for that pass when it has real work, but never
          // hold the view hostage to a slow one: those cells patch themselves
          // in afterwards either way.
          await Promise.race([
            Promise.resolve(state.hydrating),
            new Promise((resolve) => window.setTimeout(resolve, NAV_LOADER_MAX_MS)),
          ]);
        });
      });
    });

    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.filter = button.dataset.filter;
        state.page = 1;
        document.querySelectorAll('[data-filter]').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        renderArticles();
      });
    });

    document.querySelectorAll('[data-command]').forEach((button) => {
      button.addEventListener('mousedown', (event) => {
        saveEditorCursor();
        event.preventDefault();
      });
      button.addEventListener('click', () => {
        runCommand(button.dataset.command);
        updateToolbarState();
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMobileMenu();
    });
    window.addEventListener('scroll', updateScrollTopButton, { passive: true });
  }

  async function checkSession() {
    try {
      const me = await api('/api/me');
      state.user = me.user;
      els.authStatus.textContent = `${state.user.login} · ${me.permission}`;
      els.loginBtn.classList.add('hidden');
      els.logoutBtn.classList.remove('hidden');
      els.loginView.classList.add('hidden');
      els.appShell.classList.remove('hidden');
      await loadArticles();
    } catch (error) {
      setLoggedOut(authErrorMessage(error));
    }
  }

  function setLoggedOut(message) {
    state.user = null;
    els.authStatus.textContent = message;
    els.loginStatus.textContent = message;
    els.loginBtn.classList.remove('hidden');
    els.logoutBtn.classList.add('hidden');
    els.appShell.classList.add('hidden');
    els.loginView.classList.remove('hidden');
  }

  function authErrorMessage(error) {
    const message = error?.message || '';
    if (message === 'Not signed in') return 'Sign in to continue.';
    if (message === 'Failed to fetch' || error instanceof TypeError) {
      return 'We could not reach the sign-in service. Please try again in a moment.';
    }
    return friendlyError(message) || 'Sign in to continue.';
  }

  function openMobileMenu() {
    els.appShell.classList.add('mobile-menu-open');
    els.mobileMenuOverlay.classList.remove('hidden');
    els.mobileMenuToggle.setAttribute('aria-expanded', 'true');
    els.mobileMenuClose.focus();
  }

  function closeMobileMenu() {
    els.appShell.classList.remove('mobile-menu-open');
    els.mobileMenuOverlay.classList.add('hidden');
    els.mobileMenuToggle.setAttribute('aria-expanded', 'false');
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    els.scrollTopBtn.blur();
  }

  function updateScrollTopButton() {
    els.scrollTopBtn.classList.toggle('hidden', window.scrollY < 640);
  }

  function login() {
    const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.href = `${apiBaseUrl}/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => null);
    state.articles = [];
    state.detailsCache.clear();
    state.detailsLoading.clear();
    renderArticles();
    setLoggedOut('Signed out');
  }

  async function loadArticles(options = {}) {
    const force = Boolean(options.force);
    els.articleList.innerHTML = loadingHtml('Loading articles...');
    if (!force) {
      const cached = readCache(ARTICLE_LIST_CACHE_KEY);
      if (cached && Array.isArray(cached.articles)) {
        state.articles = cached.articles;
        buildTaxonomies();
        renderArticles();
        restoreRouteOnce();
        return;
      }
    }

    try {
      state.articles = await api('/api/articles?status=all');
      writeCache(ARTICLE_LIST_CACHE_KEY, { articles: state.articles });
      buildTaxonomies();
      renderArticles();
      restoreRouteOnce();
    } catch (error) {
      if (!state.articles.length) {
        els.articleList.innerHTML = loadingHtml(friendlyError(error.message) || 'Could not load articles right now.');
      }
    }
  }

  function renderArticles() {
    const list = state.articles.filter((article) => {
      const matchesStatus = state.filter === 'all' || article.status === state.filter;
      const haystack = [
        article.title,
        article.description,
        article.path,
        ...(article.categories || []),
        ...(article.tags || []),
      ]
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!state.query || haystack.includes(state.query));
    }).sort(compareArticles);
    els.articleList.innerHTML = '';
    updateCounts();

    if (!state.user) {
      els.articleList.innerHTML = loadingHtml('Sign in to view articles.');
      return;
    }

    if (!list.length) {
      els.articleList.innerHTML = loadingHtml('No articles match this view.');
      return;
    }

    const totalPages = Math.max(1, Math.ceil(list.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * state.pageSize;
    const pageItems = list.slice(start, start + state.pageSize);

    els.articleList.innerHTML = `
      <div class="table-card">
        <table class="articles-table">
          <thead>
            <tr>
              <th>Article</th>
              <th>Status</th>
              <th>Date</th>
              <th>Categories</th>
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <div class="pagination-bar">
          <span>${start + 1}-${Math.min(start + state.pageSize, list.length)} of ${list.length} articles</span>
          <div>
            <button class="button soft" type="button" data-page="prev" ${state.page === 1 ? 'disabled' : ''}>
              <i class="fa-solid fa-chevron-left"></i>
              Previous
            </button>
            <span class="page-count">Page ${state.page} of ${totalPages}</span>
            <button class="button soft" type="button" data-page="next" ${state.page === totalPages ? 'disabled' : ''}>
              Next
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    const tbody = els.articleList.querySelector('tbody');
    pageItems.forEach((article) => {
      const row = document.createElement('tr');
      const status = statusText(article.status);
      const icon = article.status === 'draft' ? 'fa-file-lines' : 'fa-circle-check';
      const pinned = Boolean(article.pin);
      row.innerHTML = `
        <td data-label="Article">
          <div class="article-cell">
            <span class="status-dot ${article.status === 'draft' ? 'draft' : ''}"><i class="fa-solid ${icon}"></i></span>
            <div>
              <strong>${escapeHtml(displayArticleTitle(article))}</strong>
              <small data-summary-for="${escapeHtml(article.path)}">${escapeHtml(displayArticleSummary(article))}</small>
            </div>
          </div>
        </td>
        <td data-label="Status">
          <span class="status-badge ${article.status === 'draft' ? 'draft' : ''}">${status}</span>
          ${pinned ? '<span class="pin-badge"><i class="fa-solid fa-thumbtack"></i> Pin</span>' : ''}
        </td>
        <td data-label="Date">${escapeHtml(displayArticleDate(article))}</td>
        <td data-label="Categories"><div class="article-tags" data-taxonomy-for="${escapeHtml(article.path)}">${taxonomyHtml(article)}</div></td>
        <td class="table-actions" data-label="Action">
          <button class="button soft" type="button">
            <i class="fa-solid fa-pen-to-square"></i>
            Edit
          </button>
        </td>
      `;
      row.querySelector('button').addEventListener('click', () => loadArticle(article.path));
      tbody.append(row);
    });
    // Kept on state so sidebar navigation can wait for it. Resolves immediately
    // when every visible row is already cached or its fetch is already in
    // flight; it only takes real time on a page whose details are still unread.
    // hydrateVisibleRows swallows per-article errors, so this never rejects.
    state.hydrating = hydrateVisibleRows(pageItems);

    els.articleList.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        state.page += button.dataset.page === 'next' ? 1 : -1;
        renderArticles();
      });
    });
  }

  async function loadArticle(path, options = {}) {
    try {
      const article = await loadArticleDetails(path);
      rememberArticleDetails(article);
      openEditor(article, options);
    } catch (error) {
      reportError(error, 'Could not open this article.');
    }
  }

  async function hydrateVisibleRows(articles) {
    const missing = articles.filter((article) => needsArticleDetails(article) && !state.detailsCache.has(article.path));
    await Promise.all(
      missing.map(async (article) => {
        if (!article.path || state.detailsLoading.has(article.path)) return;
        state.detailsLoading.add(article.path);
        try {
          const full = await loadArticleDetails(article.path);
          rememberArticleDetails(full);
          Object.assign(article, full);
          const summary = els.articleList.querySelector(`[data-summary-for="${cssEscape(article.path)}"]`);
          if (summary) summary.textContent = displayArticleSummary(article);
          const taxonomy = els.articleList.querySelector(`[data-taxonomy-for="${cssEscape(article.path)}"]`);
          if (taxonomy) taxonomy.innerHTML = taxonomyHtml(article);
        } catch (_) {
          // Keep the list usable even when one article cannot be expanded.
        } finally {
          state.detailsLoading.delete(article.path);
        }
      }),
    );
  }

  function needsArticleDetails(article) {
    return !article.description || !(article.categories || []).length || !(article.tags || []).length || article.pin === undefined;
  }

  function rememberArticleDetails(article) {
    if (!article || !article.path) return;
    state.detailsCache.set(article.path, article);
    writeCache(articleDetailCacheKey(article.path), { article });
    const existing = state.articles.find((item) => item.path === article.path);
    if (existing) Object.assign(existing, article);
  }

  function upsertArticle(article, originalPath = '') {
    if (!article?.path) return;
    if (originalPath && originalPath !== article.path) removeArticleFromState(originalPath, { render: false });
    const existing = state.articles.find((item) => item.path === article.path);
    if (existing) Object.assign(existing, article);
    else state.articles.unshift(article);
    rememberArticleDetails(article);
    buildTaxonomies();
    renderArticles();
  }

  function removeArticleFromState(path, options = {}) {
    state.articles = state.articles.filter((article) => article.path !== path);
    state.detailsCache.delete(path);
    state.detailsLoading.delete(path);
    removeCache(articleDetailCacheKey(path));
    writeCache(ARTICLE_LIST_CACHE_KEY, { articles: state.articles });
    buildTaxonomies();
    if (options.render !== false) renderArticles();
  }

  async function loadArticleDetails(path, options = {}) {
    const force = Boolean(options.force);
    if (!force && state.detailsCache.has(path)) return state.detailsCache.get(path);
    if (!force) {
      const cached = readCache(articleDetailCacheKey(path));
      if (cached?.article) {
        rememberArticleDetails(cached.article);
        return cached.article;
      }
    }
    const article = await api(`/api/articles/${encodeURIComponent(path)}`);
    rememberArticleDetails(article);
    return article;
  }

  function openEditor(article, options = {}) {
    state.current = article;
    state.mode = 'rich';
    state.preview = false;
    els.screenTitle.textContent = article.path ? 'Edit article' : 'Write new';
    setActiveNav(article.path ? '' : 'new');
    showOnly(els.editorView);
    fillEditor(article);
    updateRoute(article.path ? { view: 'editor', path: article.path } : { view: 'new' }, options);
  }

  function fillEditor(article) {
    els.title.value = article.title || '';
    els.description.value = article.description || '';
    els.date.value = article.date || today();
    els.category.value = (article.categories && article.categories.length ? article.categories : ['Sermon Notes']).join(', ');
    els.tags.value = (article.tags || []).map(normalizeTag).join(', ');
    els.comments.checked = Boolean(article.comments);
    els.pin.checked = Boolean(article.pin);
    els.imageInput.value = cleanImageValue(article.image || '');
    els.slug.value = article.slug || slugify(article.title || 'untitled-article');
    els.markdown.value = article.body || '';
    els.rich.innerHTML = markdownToHtml(article.body || '');
    renderBibleBlocks(els.rich);
    els.statusLabel.textContent = statusText(article.status || 'draft');
    setButtonLabel(
      els.draftBtn,
      article.status === 'published' ? 'Move to draft' : 'Save draft'
    );
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
      categories: splitCommaList(els.category.value || 'Sermon Notes'),
      tags: splitTags(els.tags.value),
      description: els.description.value.trim(),
        image: cleanImageValue(els.imageInput.value),
      comments: els.comments.checked,
      pin: els.pin.checked,
      slug,
      body,
    };
  }

  async function saveArticle(kind) {
    const publishing = kind === 'publish';
    const activeButton = publishing ? els.publishBtn : els.draftBtn;
    if (!beginEditorAction(activeButton, publishing ? 'Publishing...' : 'Saving...')) {
      return;
    }

    const article = collectArticle();
    const originalPath = state.current?.path || article.originalPath || '';

    let saved;
    try {
      saved = await api(`/api/articles/${kind}`, {
        method: 'POST',
        body: JSON.stringify(article),
      });
    } catch (error) {
      reportError(error, 'Could not save this article.');
      return;
    } finally {
      // Runs before the success path below, so fillEditor gets the last word on
      // the draft button's label.
      endEditorAction();
    }

    if (!saved || !saved.article) {
      reportError(
        new Error('The publishing service did not return the saved article.'),
        'Could not save this article.'
      );
      return;
    }

    upsertArticle(saved.article, originalPath);
    state.current = saved.article;
    fillEditor(saved.article);
    updateRoute({ view: 'editor', path: saved.article.path }, { replace: true });
    writeCache(ARTICLE_LIST_CACHE_KEY, { articles: state.articles });
    showToast(
      publishing ? 'Article published to the site.' : 'Draft saved.',
      'success'
    );
  }

  async function deleteArticle() {
    if (!state.current || !state.current.path) {
      showToast('There is nothing to delete yet.', 'info');
      return;
    }

    const confirmed = window.confirm('Delete this article? This cannot be undone from the CMS.');
    if (!confirmed) return;

    const deletedPath = state.current.path;
    if (!beginEditorAction(els.deleteBtn, 'Deleting...')) return;

    try {
      await api(`/api/articles/${encodeURIComponent(deletedPath)}`, { method: 'DELETE' });
    } catch (error) {
      reportError(error, 'Could not delete this article.');
      return;
    } finally {
      endEditorAction();
    }

    removeArticleFromState(deletedPath);
    state.current = null;
    showArticles();
    showToast('Article deleted.', 'success');
  }

  async function uploadImage() {
    const file = els.imageFile.files && els.imageFile.files[0];
    if (!file) return;
    if (!beginEditorAction(els.uploadImageBtn, 'Uploading...')) return;

    try {
      let uploadFile;
      try {
        uploadFile = await prepareImageForUpload(file);
      } catch (error) {
        reportError(error, 'Could not prepare this image.');
        return;
      }

      const originalSize = formatBytes(file.size);
      const uploadSize = formatBytes(uploadFile.size);
      const wasCompressed = uploadFile !== file;
      els.imageUploadNote.textContent = wasCompressed
        ? `Compressed from ${originalSize} to ${uploadSize} before upload.`
        : `Image size ${uploadSize}.`;

      let base64;
      try {
        base64 = await fileToBase64(uploadFile);
      } catch (error) {
        reportError(error, 'Could not read this image file.');
        return;
      }

      let response;
      try {
        response = await api('/api/media', {
          method: 'POST',
          body: JSON.stringify({
            fileName: uploadFile.name,
            mimeType: uploadFile.type || 'application/octet-stream',
            base64,
            slug: slugify(els.slug.value || els.title.value || uploadFile.name),
          }),
        });
      } catch (error) {
        reportError(error, 'Could not upload this image.');
        return;
      }

      if (!response || !response.path) {
        reportError(
          new Error('The upload did not return an image path.'),
          'Could not upload this image.'
        );
        return;
      }

      els.imageInput.value = response.path;
      updateImagePreview();
      showToast('Featured image uploaded.', 'success');
    } finally {
      endEditorAction();
      // Clear the input so re-picking the same file still fires `change`.
      els.imageFile.value = '';
    }
  }

  function showArticles(options = {}) {
    els.screenTitle.textContent = 'Articles';
    showOnly(els.listView);
    setActiveNav('articles');
    renderArticles();
    updateRoute({ view: 'articles' }, options);
  }

  function showView(view, options = {}) {
    if (view === 'media') {
      els.screenTitle.textContent = 'Media';
      setActiveNav('media');
      showOnly(els.mediaView);
      updateRoute({ view: 'media' }, options);
    } else {
      showArticles();
    }
  }

  function restoreRouteOnce() {
    if (state.routeRestored) return;
    state.routeRestored = true;
    restoreRoute({ replace: true });
  }

  function restoreRoute(options = {}) {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const path = params.get('path');

    if (view === 'editor' && path) {
      loadArticle(path, { replace: options.replace !== false });
      return;
    }

    if (view === 'new') {
      openEditor(newArticle(), { replace: options.replace !== false });
      return;
    }

    if (view === 'media') {
      showView('media', { replace: options.replace !== false });
      return;
    }

    showArticles({ replace: options.replace !== false });
  }

  function updateRoute(route, options = {}) {
    if (!state.user) return;

    const url = new URL(window.location.href);
    url.search = '';

    if (route.view && route.view !== 'articles') {
      url.searchParams.set('view', route.view);
    }
    if (route.path) {
      url.searchParams.set('path', route.path);
    }

    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === current) return;

    if (options.replace) window.history.replaceState({}, '', next);
    else window.history.pushState({}, '', next);
  }

  function setActiveNav(nav) {
    document.querySelectorAll('[data-nav]').forEach((item) => {
      item.classList.toggle('active', Boolean(nav) && item.dataset.nav === nav);
    });
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
      renderBibleBlocks(els.rich);
      state.mode = 'rich';
    }
    state.preview = false;
    syncEditorMode();
  }

  function togglePreview() {
    state.preview = !state.preview;
    if (state.preview) {
      els.preview.innerHTML = markdownToHtml(currentMarkdown());
      renderBibleBlocks(els.preview);
    }
    syncEditorMode();
  }

  function syncEditorMode() {
    els.modeToggle.classList.toggle('active', state.mode === 'markdown');
    const modeIcon = els.modeToggle.querySelector('i');
    if (modeIcon) {
      modeIcon.className =
        state.mode === 'markdown'
          ? 'fa-solid fa-pen-to-square'
          : 'fa-solid fa-code';
    }
    setButtonLabel(
      els.modeToggle,
      state.mode === 'markdown' ? 'Easy editor' : 'Plain text'
    );
    els.previewToggle.classList.toggle('active', state.preview);
    els.preview.classList.toggle('hidden', !state.preview);
    els.rich.classList.toggle('hidden', state.preview || state.mode !== 'rich');
    els.markdown.classList.toggle('hidden', state.preview || state.mode !== 'markdown');
    updateToolbarState();
  }

  function currentMarkdown() {
    return state.mode === 'markdown' ? els.markdown.value : htmlToMarkdown(els.rich.innerHTML);
  }

  function updateToolbarState() {
    saveMarkdownSelection();
    saveRichSelection();
    const buttons = document.querySelectorAll('[data-command]');
    buttons.forEach((button) => button.classList.remove('active'));
    if (state.preview) return;

    const active = state.mode === 'markdown' ? markdownActiveCommands() : richActiveCommands();
    buttons.forEach((button) => {
      button.classList.toggle('active', active.has(button.dataset.command));
    });
  }

  function richActiveCommands() {
    const active = new Set();
    if (document.activeElement !== els.rich && !els.rich.contains(getSelectionNode())) return active;

    const commandMap = {
      bold: 'bold',
      italic: 'italic',
      strike: 'strikeThrough',
      ul: 'insertUnorderedList',
      ol: 'insertOrderedList',
    };

    Object.entries(commandMap).forEach(([key, command]) => {
      try {
        if (document.queryCommandState(command)) active.add(key);
      } catch (_) {}
    });

    const block = currentBlockElement();
    if (!block) return active;

    const tag = block.tagName.toLowerCase();
    if (tag === 'h2') active.add('heading2');
    if (tag === 'h3') active.add('heading3');
    if (block.closest('blockquote')) active.add('quote');
    if (block.closest('code')) active.add('code');
    if (block.closest('a')) active.add('link');
    return active;
  }

  function markdownActiveCommands() {
    const active = new Set();
    const textarea = els.markdown;
    if (document.activeElement !== textarea) return active;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.slice(start, end);
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIndex = value.indexOf('\n', end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const line = value.slice(lineStart, lineEnd);
    const contextStart = Math.max(0, start - 80);
    const contextEnd = Math.min(value.length, end + 80);
    const context = value.slice(contextStart, contextEnd);

    if (/^##\s+/.test(line)) active.add('heading2');
    if (/^###\s+/.test(line)) active.add('heading3');
    if (/^>\s?/.test(line)) active.add('quote');
    if (/^\s*[-*+]\s+/.test(line)) active.add('ul');
    if (/^\s*\d+[.)]\s+/.test(line)) active.add('ol');
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) active.add('hr');
    if (isWrappedBy(context, selected, '**')) active.add('bold');
    if (isWrappedBy(context, selected, '_') || isWrappedBy(context, selected, '*')) active.add('italic');
    if (isWrappedBy(context, selected, '~~')) active.add('strike');
    if (isWrappedBy(context, selected, '`')) active.add('code');
    if (/\[[^\]]*$/.test(value.slice(contextStart, start)) && /^[^\]]*\]\([^)]+\)/.test(value.slice(start, contextEnd))) active.add('link');
    return active;
  }

  function isWrappedBy(context, selected, wrapper) {
    if (selected) return context.includes(`${wrapper}${selected}${wrapper}`);
    return context.lastIndexOf(wrapper, Math.floor(context.length / 2)) !== -1 &&
      context.indexOf(wrapper, Math.floor(context.length / 2)) !== -1;
  }

  function getSelectionNode() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    return selection.anchorNode?.nodeType === Node.TEXT_NODE ? selection.anchorNode.parentElement : selection.anchorNode;
  }

  function saveRichSelection() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const node = selection.anchorNode?.nodeType === Node.TEXT_NODE ? selection.anchorNode.parentElement : selection.anchorNode;
    if (node && els.rich.contains(node)) {
      state.savedRichRange = selection.getRangeAt(0).cloneRange();
    }
  }

  function saveMarkdownSelection() {
    if (document.activeElement !== els.markdown) return;
    state.savedMarkdownSelection = {
      start: els.markdown.selectionStart,
      end: els.markdown.selectionEnd,
    };
  }

  function saveEditorCursor() {
    if (state.mode === 'markdown') saveMarkdownSelection();
    else saveRichSelection();
  }

  function restoreRichSelection() {
    if (!isSavedRichRangeValid()) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(state.savedRichRange);
    return true;
  }

  function isSavedRichRangeValid() {
    if (!state.savedRichRange) return false;
    const container = state.savedRichRange.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    return Boolean(element && (element === els.rich || els.rich.contains(element)));
  }

  function currentBlockElement() {
    let node = getSelectionNode();
    while (node && node !== els.rich) {
      if (/^(h1|h2|h3|h4|h5|h6|p|blockquote|li|div|pre)$/i.test(node.tagName || '')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function runCommand(command) {
    if (command === 'scripture') {
      prepareInsertPoint();
      toggleScripturePanel();
      return;
    }
    if (command === 'table') {
      prepareInsertPoint();
      toggleTablePanel();
      return;
    }

    if (state.mode === 'markdown') {
      wrapMarkdown(command);
      return;
    }

    els.rich.focus();
    if (command === 'bold') document.execCommand('bold');
    if (command === 'italic') document.execCommand('italic');
    if (command === 'strike') document.execCommand('strikeThrough');
    if (command === 'heading2') document.execCommand('formatBlock', false, 'h2');
    if (command === 'heading3') document.execCommand('formatBlock', false, 'h3');
    if (command === 'quote') document.execCommand('formatBlock', false, 'blockquote');
    if (command === 'ul') document.execCommand('insertUnorderedList');
    if (command === 'ol') document.execCommand('insertOrderedList');
    if (command === 'code') insertRichHtml('<code>code</code>');
    if (command === 'hr') insertRichHtml('<hr>');
    if (command === 'link') {
      const url = window.prompt('Paste the link');
      if (safeUrl(url)) document.execCommand('createLink', false, url);
    }
    if (command === 'image') {
      const url = window.prompt('Paste the image link');
      if (safeUrl(url)) document.execCommand('insertImage', false, url);
    }
  }

  function insertRichHtml(html) {
    els.rich.focus();
    const marker = findRichInsertMarker();
    if (marker) {
      insertRichHtmlAtMarker(html, marker);
      return;
    }

    const range = isSavedRichRangeValid() ? state.savedRichRange.cloneRange() : rangeAtEditorEnd();
    const fragment = document.createRange().createContextualFragment(html);
    const lastNode = fragment.lastChild;
    range.deleteContents();
    range.insertNode(fragment);

    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(nextRange);
      state.savedRichRange = nextRange.cloneRange();
    }

    saveRichSelection();
  }

  function insertRichHtmlAtMarker(html, marker = findRichInsertMarker()) {
    if (!marker || !els.rich.contains(marker)) {
      insertRichHtml(html);
      return;
    }

    const fragment = document.createRange().createContextualFragment(html);
    const lastNode = fragment.lastChild;
    marker.replaceWith(fragment);
    state.richInsertMarkerId = '';
    removeRichInsertMarker();

    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(nextRange);
      state.savedRichRange = nextRange.cloneRange();
    }

    els.rich.focus();
    saveRichSelection();
  }

  function rangeAtEditorEnd() {
    const range = document.createRange();
    range.selectNodeContents(els.rich);
    range.collapse(false);
    return range;
  }

  function prepareInsertPoint() {
    if (state.mode === 'markdown') {
      saveMarkdownSelection();
      return;
    }
    placeRichInsertMarker();
  }

  function placeRichInsertMarker() {
    removeRichInsertMarker();
    saveRichSelection();
    const range = isSavedRichRangeValid() ? state.savedRichRange.cloneRange() : getCurrentRichRange();
    if (!range) return;

    const marker = document.createElement('span');
    marker.id = `editor-insert-marker-${Date.now()}`;
    marker.className = 'editor-insert-marker';
    marker.dataset.editorInsertMarker = 'true';
    marker.appendChild(document.createTextNode('\u200b'));

    range.deleteContents();
    range.insertNode(marker);

    const nextRange = document.createRange();
    nextRange.setStartAfter(marker);
    nextRange.collapse(true);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(nextRange);
    }
    state.savedRichRange = nextRange.cloneRange();
    state.richInsertMarkerId = marker.id;
  }

  function getCurrentRichRange() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    if (!element || (element !== els.rich && !els.rich.contains(element))) return null;
    return range.cloneRange();
  }

  function findRichInsertMarker() {
    if (state.richInsertMarkerId) {
      const marker = document.getElementById(state.richInsertMarkerId);
      if (marker && els.rich.contains(marker)) return marker;
    }
    return els.rich.querySelector('[data-editor-insert-marker="true"]');
  }

  function removeRichInsertMarker() {
    els.rich.querySelectorAll('[data-editor-insert-marker="true"]').forEach((marker) => marker.remove());
    state.richInsertMarkerId = '';
  }

  function wrapMarkdown(command) {
    const textarea = els.markdown;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || 'text';
    const wrappers = {
      bold: [`**${selected}**`, 2],
      italic: [`_${selected}_`, 1],
      strike: [`~~${selected}~~`, 2],
      code: [`\`${selected}\``, 1],
      heading2: [`## ${selected}`, 3],
      heading3: [`### ${selected}`, 4],
      quote: [`> ${selected}`, 2],
      ul: [`- ${selected}`, 2],
      ol: [`1. ${selected}`, 3],
      hr: ['\n---\n', 4],
      link: [`[${selected}](https://example.com)`, 1],
      image: [`![${selected}](/assets/img/thumbnails/image.jpg)`, 2],
      table: [buildTableMarkdown(2, 2), 2],
      scripture: [scriptureBlockMarkup(selected && selected !== 'text' ? selected : 'John 3:16', 'quote', 'kjv'), 2],
    };
    const [replacement, offset] = wrappers[command] || [selected, 0];
    textarea.setRangeText(replacement, start, end, 'end');
    textarea.focus();
    textarea.selectionStart = start + offset;
  }

  function toggleScripturePanel() {
    if (state.mode === 'markdown') saveEditorCursor();
    else if (!findRichInsertMarker()) placeRichInsertMarker();
    els.tablePanel.classList.add('hidden');
    els.scripturePanel.classList.toggle('hidden');
    if (!els.scripturePanel.classList.contains('hidden')) {
      const selected = selectedEditorText();
      if (selected) els.scriptureReference.value = selected;
      els.scriptureReference.focus();
    }
  }

  function toggleTablePanel() {
    if (state.mode === 'markdown') saveEditorCursor();
    else if (!findRichInsertMarker()) placeRichInsertMarker();
    els.scripturePanel.classList.add('hidden');
    els.tablePanel.classList.toggle('hidden');
    if (!els.tablePanel.classList.contains('hidden')) {
      els.tableColumns.focus();
      els.tableColumns.select();
    }
  }

  function insertConfiguredTable() {
    const columns = clampNumber(els.tableColumns.value, 1, 12, 2);
    const rows = clampNumber(els.tableRows.value, 1, 50, 2);
    const markdown = buildTableMarkdown(columns, rows);

    if (state.mode === 'markdown') {
      insertIntoTextarea(els.markdown, markdown, { useSavedSelection: true });
    } else {
      insertRichHtmlAtMarker(markdownToHtml(markdown));
    }

    els.tablePanel.classList.add('hidden');
  }

  function buildTableMarkdown(columns, rows) {
    const safeColumns = clampNumber(columns, 1, 12, 2);
    const safeRows = clampNumber(rows, 1, 50, 2);
    const header = Array.from({ length: safeColumns }, (_, index) => `Heading ${index + 1}`);
    const divider = Array.from({ length: safeColumns }, () => '---');
    const body = Array.from({ length: safeRows }, () => Array.from({ length: safeColumns }, () => '').join(' | '));
    return [
      `| ${header.join(' | ')} |`,
      `| ${divider.join(' | ')} |`,
      ...body.map((row) => `| ${row} |`),
    ].join('\n');
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function selectedEditorText() {
    if (state.mode === 'markdown') {
      return els.markdown.value.slice(els.markdown.selectionStart, els.markdown.selectionEnd).trim();
    }
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !els.rich.contains(selection.anchorNode)) return '';
    return selection.toString().trim();
  }

  function insertScriptureBlock() {
    const reference = els.scriptureReference.value.trim();
    if (!reference) {
      els.scriptureReference.focus();
      return;
    }

    const mode = els.scriptureMode.value === 'comparison' ? 'comparison' : 'quote';
    const translation = els.scriptureTranslation.value === 'tgl' ? 'tgl' : 'kjv';
    const marker = scriptureBlockMarkup(reference, mode, translation);

    if (state.mode === 'markdown') {
      insertIntoTextarea(els.markdown, marker, { useSavedSelection: true });
    } else {
      insertRichHtmlAtMarker(markdownToHtml(marker));
      requestAnimationFrame(() => renderBibleBlocks(els.rich));
    }

    els.scripturePanel.classList.add('hidden');
  }

  function cancelInsertPanels() {
    els.scripturePanel.classList.add('hidden');
    els.tablePanel.classList.add('hidden');
    if (state.mode === 'rich') removeRichInsertMarker();
  }

  function scriptureBlockMarkup(reference, mode, translation) {
    return `<div class="bible-insert" data-reference="${escapeHtml(reference)}" data-mode="${escapeHtml(mode)}" data-translation="${escapeHtml(translation)}"></div>`;
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
    const value = cleanImageValue(els.imageInput.value);
    if (value !== els.imageInput.value.trim()) els.imageInput.value = value;
    if (!value) {
      els.imagePreview.textContent = 'No image chosen';
      return;
    }
    const src = value.startsWith('http') || value.startsWith('/') ? value : `/${value}`;
    els.imagePreview.innerHTML = `<img src="${escapeHtml(src)}" alt="">`;
  }

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        ...options,
      });
    } catch (_) {
      // fetch only rejects for network-level failures, never for HTTP errors
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const error = new Error(
        offline
          ? 'You appear to be offline. Reconnect and try again.'
          : 'Could not reach the publishing service. Check your connection and try again.'
      );
      error.offline = true;
      throw error;
    }

    if (!response.ok) {
      // Read the body exactly once. Reading it as JSON and then falling back to
      // text() throws "body stream already read" and masks the real failure.
      const raw = await response.text().catch(() => '');
      let message = '';
      try {
        message = (JSON.parse(raw) || {}).error || '';
      } catch (_) {
        message = raw;
      }
      message = String(message || '').trim();
      // A proxy or gateway can answer with an HTML error page; showing that
      // markup verbatim is worse than saying nothing useful.
      if (!message || message.startsWith('<') || message.length > 200) {
        message = `The publishing service returned an error (${response.status}). Please try again.`;
      }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) return null;
    return response.json();
  }

  function readCache(key) {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (!cached || Date.now() - cached.savedAt > CACHE_TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return cached.value;
    } catch (_) {
      localStorage.removeItem(key);
      return null;
    }
  }

  function writeCache(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
    } catch (_) {}
  }

  function removeCache(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function articleDetailCacheKey(path) {
    return `${ARTICLE_DETAIL_CACHE_PREFIX}${encodeURIComponent(path)}`;
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
      pin: false,
      slug: 'untitled-article',
      body: '',
    };
  }

  function cleanImageValue(value) {
    const clean = String(value || '').trim();
    return /^[a-z_]+:\s*(true|false)?$/i.test(clean) ? '' : clean;
  }

  function loadingHtml(message) {
    return `<div class="empty-state"><p>${escapeHtml(message)}</p></div>`;
  }

  const TOAST_MS = { success: 4200, info: 4200, error: 8000 };
  const TOAST_ICON = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info',
  };

  function showToast(message, kind = 'info') {
    const region = els.toastRegion;
    const text = String(message || '').trim();
    if (!region || !text) return;

    // Repeating an identical message just restarts its timer instead of stacking.
    const last = region.lastElementChild;
    if (last && last.dataset.message === text && !last.classList.contains('leaving')) {
      startToastTimer(last, kind);
      return;
    }

    while (region.children.length >= 3) {
      region.firstElementChild.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${kind}`;
    toast.dataset.message = text;
    // Errors interrupt; success and info wait for a pause in the announcements.
    if (kind === 'error') toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <i class="fa-solid ${TOAST_ICON[kind] || TOAST_ICON.info}" aria-hidden="true"></i>
      <span class="toast-message"></span>
      <button class="toast-close" type="button" aria-label="Dismiss message">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    `;
    // textContent, not innerHTML: server error strings are untrusted input.
    toast.querySelector('.toast-message').textContent = text;
    toast
      .querySelector('.toast-close')
      .addEventListener('click', () => dismissToast(toast));

    region.append(toast);
    startToastTimer(toast, kind);
  }

  function startToastTimer(toast, kind) {
    window.clearTimeout(Number(toast.dataset.timer) || 0);
    const ms = TOAST_MS[kind] || TOAST_MS.info;
    toast.dataset.timer = String(window.setTimeout(() => dismissToast(toast), ms));
  }

  function dismissToast(toast) {
    if (!toast || toast.classList.contains('leaving')) return;
    window.clearTimeout(Number(toast.dataset.timer) || 0);
    toast.classList.add('leaving');
    window.setTimeout(() => toast.remove(), 200);
  }

  // Shown while a sidebar view swaps. Held for a short minimum so a cached,
  // instant switch still reads as a deliberate transition instead of a flicker.
  const NAV_LOADER_MIN_MS = 320;
  const NAV_LOADER_MAX_MS = 2000;
  let navLoaderDepth = 0;

  function beginNavLoader() {
    const el = els.navLoader;
    if (!el) return () => Promise.resolve();
    navLoaderDepth += 1;
    el.classList.remove('hidden');
    el.setAttribute('aria-busy', 'true');
    const startedAt = Date.now();

    return () =>
      new Promise((resolve) => {
        const remaining = Math.max(0, NAV_LOADER_MIN_MS - (Date.now() - startedAt));
        window.setTimeout(() => {
          navLoaderDepth = Math.max(0, navLoaderDepth - 1);
          // Only the last outstanding navigation clears it.
          if (navLoaderDepth === 0) {
            el.classList.add('hidden');
            el.removeAttribute('aria-busy');
          }
          resolve();
        }, remaining);
      });
  }

  async function withNavLoader(run) {
    const endNavLoader = beginNavLoader();
    try {
      await run();
    } catch (error) {
      reportError(error, 'Could not open that view.');
    } finally {
      await endNavLoader();
    }
  }

  function editorActionButtons() {
    return [
      els.publishBtn,
      els.draftBtn,
      els.deleteBtn,
      els.uploadImageBtn,
    ].filter(Boolean);
  }

  // Locks every editor action while one is in flight and marks the clicked
  // button busy. Returns false if something is already running, so a rapid
  // second click cannot start a duplicate request.
  function beginEditorAction(activeButton, busyLabel) {
    if (state.busy) return false;
    state.busy = true;
    editorActionButtons().forEach((button) => {
      button.disabled = true;
    });
    if (activeButton) {
      const label = activeButton.querySelector('.button-label');
      if (label && !activeButton.dataset.idleLabel) {
        activeButton.dataset.idleLabel = label.textContent;
      }
      activeButton.classList.add('is-busy');
      if (busyLabel) setButtonLabel(activeButton, busyLabel);
    }
    return true;
  }

  function endEditorAction() {
    state.busy = false;
    editorActionButtons().forEach((button) => {
      button.disabled = false;
      button.classList.remove('is-busy');
      if (button.dataset.idleLabel) {
        setButtonLabel(button, button.dataset.idleLabel);
        delete button.dataset.idleLabel;
      }
    });
  }

  function reportError(error, fallback) {
    // 401 means the 8h session cookie is gone; keeping the editor open would
    // just fail again on every action, so say so plainly and send them back.
    const expired = Boolean(error && error.status === 401);
    const message = expired
      ? 'Your sign-in expired. Please sign in again.'
      : friendlyError(error && error.message) || fallback;
    showToast(message, 'error');
    if (expired) setLoggedOut(message);
    return message;
  }

  function statusText(status) {
    if (status === 'published') return 'Published';
    if (status === 'draft') return 'Draft';
    return 'Draft';
  }

  function friendlyError(message) {
    const text = String(message || '');
    const lower = text.toLowerCase();

    if (!text) return '';
    if (lower.includes('admin_github_logins')) return 'Your account is not allowed to use this CMS yet.';
    if (lower.includes('repository write access')) return 'Your account can sign in, but it cannot update the website yet.';
    if (lower.includes('oauth') || lower.includes('token exchange')) return 'Sign-in could not be completed. Please try again.';
    if (lower.includes('missing worker config')) return 'The admin sign-in service is missing a setup value.';
    if (lower.includes('not found')) return 'We could not find that item.';
    if (lower.includes('bad credentials')) return 'The website connection needs to be refreshed by the site manager.';
    if (lower.includes('rate limit')) return 'Too many requests were made. Please wait a few minutes and try again.';
    if (lower.includes('unexpected cms api error')) return 'Something went wrong while contacting the website. Please try again.';

    return text;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function splitTags(value) {
    return splitCommaList(value)
      .map((tag) => tag.toLowerCase());
  }

  function splitCommaList(value) {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function buildTaxonomies() {
    const categories = new Set(['Sermon Notes', 'Bible Study', 'Devotional', 'Apostolic Identity']);
    const tags = new Set();

    state.articles.forEach((article) => {
      (article.categories || []).forEach((category) => categories.add(category));
      (article.tags || []).forEach((tag) => tags.add(tag));
    });

    state.categories = [...categories].sort((a, b) => a.localeCompare(b));
    state.tags = [...tags].sort((a, b) => a.localeCompare(b));
    renderTaxonomyOptions();
  }

  function renderTaxonomyOptions() {
    renderTaxonomyPanel('category');
    renderTaxonomyPanel('tag');
  }

  function renderTaxonomyPanel(type) {
    const input = type === 'category' ? els.category : els.tags;
    const panel = type === 'category' ? els.categoryChips : els.tagChips;
    const values = type === 'category' ? state.categories : state.tags.map(normalizeTag);
    const current = committedTokens(input.value).map((item) => item.toLowerCase());
    const query = currentToken(input.value).toLowerCase();
    const matches = [...new Set(values)]
      .filter((value) => !current.includes(value.toLowerCase()))
      .filter((value) => !query || value.toLowerCase().includes(query));

    panel.innerHTML = matches.length
      ? matches.map((value) => chipHtml(value, type)).join('')
      : `<p class="taxonomy-empty">Press Enter to add "${escapeHtml(currentToken(input.value) || 'new value')}"</p>`;

    panel.querySelectorAll('button').forEach((button) => {
      // Keep focus in the input. Blurring it runs the tag normaliser, which
      // strips the trailing comma that marks "not mid-token" -- and then the
      // next suggestion overwrites the last tag instead of appending to it.
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => {
        appendToken(input, button.dataset.value);
        renderTaxonomyPanel(type);
        input.focus();
      });
    });
  }

  function chipHtml(value, type) {
    const icon = type === 'category' ? 'fa-folder' : 'fa-tag';
    return `<button type="button" data-value="${escapeHtml(value)}"><i class="fa-solid ${icon}"></i>${escapeHtml(value)}</button>`;
  }

  function toggleTaxonomyPanel(type) {
    const target = type === 'category' ? els.categoryChips : els.tagChips;
    const other = type === 'category' ? els.tagChips : els.categoryChips;
    other.classList.add('hidden');
    renderTaxonomyPanel(type);
    target.classList.toggle('hidden');
  }

  function showTaxonomySuggestions(type) {
    const panel = type === 'category' ? els.categoryChips : els.tagChips;
    const other = type === 'category' ? els.tagChips : els.categoryChips;
    other.classList.add('hidden');
    renderTaxonomyPanel(type);
    panel.classList.remove('hidden');
  }

  function handleTokenKeydown(event, type) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const input = type === 'category' ? els.category : els.tags;
    const value = type === 'tag' ? normalizeTag(currentToken(input.value)) : currentToken(input.value);
    if (value) appendToken(input, value);
    input.value = type === 'tag' ? ensureTrailingComma(normalizeTagInput(input.value)) : ensureTrailingComma(input.value);
    showTaxonomySuggestions(type);
  }

  function appendToken(input, value) {
    const isTagInput = input === els.tags;
    const token = isTagInput ? normalizeTag(value) : String(value || '').trim();
    if (!token) return;
    const kept = committedTokens(input.value);
    const normalizedCurrent = isTagInput ? kept.map(normalizeTag) : kept;
    if (!normalizedCurrent.some((item) => item.toLowerCase() === token.toLowerCase())) {
      normalizedCurrent.push(token);
    }
    input.value = ensureTrailingComma(normalizedCurrent.join(', '));
  }

  function currentToken(value) {
    return String(value || '').split(',').pop().trim();
  }

  // Tokens the user has finished entering. A trailing comma (or an empty field)
  // means there is no partial token, so every segment counts; otherwise the last
  // segment is still being typed and a chosen suggestion replaces it.
  function committedTokens(value) {
    const raw = String(value || '');
    if (!raw.trim() || /,\s*$/.test(raw)) return splitCommaList(raw);
    return splitCommaList(withoutCurrentToken(raw));
  }

  function withoutCurrentToken(value) {
    const parts = String(value || '').split(',');
    parts.pop();
    return parts.join(',');
  }

  function ensureTrailingComma(value) {
    const clean = splitCommaList(value).join(', ');
    return clean ? `${clean}, ` : '';
  }

  function normalizeTagInput(value) {
    return splitCommaList(value).map(normalizeTag).join(', ');
  }

  function normalizeTag(value) {
    return String(value || '').trim().toLowerCase();
  }

  function updateCounts() {
    const published = state.articles.filter((article) => article.status === 'published').length;
    const drafts = state.articles.filter((article) => article.status === 'draft').length;
    els.totalCount.textContent = String(state.articles.length);
    els.publishedCount.textContent = String(published);
    els.draftCount.textContent = String(drafts);
  }

  function compareArticles(a, b) {
    if (state.sort === 'oldest') return articleTime(a) - articleTime(b) || titleSort(a, b);
    if (state.sort === 'title') return titleSort(a, b);
    if (state.sort === 'status') {
      return statusSort(a, b) || articleTime(b) - articleTime(a) || titleSort(a, b);
    }
    return articleTime(b) - articleTime(a) || titleSort(a, b);
  }

  function articleTime(article) {
    const fromDate = Date.parse(article.date || '');
    if (!Number.isNaN(fromDate)) return fromDate;
    const match = String(article.path || '').match(/(\d{4}-\d{2}-\d{2})/);
    const fromPath = match ? Date.parse(match[1]) : NaN;
    return Number.isNaN(fromPath) ? 0 : fromPath;
  }

  function displayArticleDate(article) {
    const date = article.date || dateFromPath(article.path);
    return date || 'No date set';
  }

  function displayArticleTitle(article) {
    return titleCase(stripLeadingDate(article.title || titleFromPath(article.path)));
  }

  function displayArticleSummary(article) {
    return article.description || excerptFromMarkdown(article.body) || 'No summary yet';
  }

  function taxonomyHtml(article) {
    const taxonomy = [...(article.categories || []), ...(article.tags || []).slice(0, 3)];
    return taxonomy.map((value) => `<span>${escapeHtml(value)}</span>`).join('');
  }

  function dateFromPath(path) {
    const match = String(path || '').match(/(?:^|\/)(\d{4}-\d{2}-\d{2})-/);
    return match ? match[1] : '';
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

  function titleSort(a, b) {
    return displayArticleTitle(a).localeCompare(displayArticleTitle(b));
  }

  function statusSort(a, b) {
    const order = { published: 0, draft: 1 };
    return (order[a.status] ?? 2) - (order[b.status] ?? 2);
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

  function handleEditorPaste(event) {
    const data = event.clipboardData;
    if (!data) return;

    const html = data.getData('text/html');
    const plain = data.getData('text/plain');
    if (!html && !plain) return;

    event.preventDefault();
    const markdown = html ? htmlToMarkdown(html) : cleanPastedText(plain);

    if (state.mode === 'markdown' || event.currentTarget === els.markdown) {
      insertIntoTextarea(els.markdown, markdown);
      return;
    }

    document.execCommand('insertHTML', false, markdownToHtml(markdown));
  }

  function insertIntoTextarea(textarea, value, options = {}) {
    const saved = state.savedMarkdownSelection || {};
    const start = options.useSavedSelection ? saved.start ?? textarea.selectionStart : textarea.selectionStart;
    const end = options.useSavedSelection ? saved.end ?? textarea.selectionEnd : textarea.selectionEnd;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
    const suffix = after && !after.startsWith('\n') ? '\n\n' : '';
    const replacement = `${prefix}${value}${suffix}`;
    textarea.setRangeText(replacement, start, end, 'end');
    textarea.focus();
    state.savedMarkdownSelection = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  }

  function markdownToHtml(markdown) {
    const lines = normalizeMarkdown(markdown).split('\n');
    const html = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) {
        index += 1;
        continue;
      }

      if (isBibleBlockMarkup(trimmed)) {
        html.push(sanitizeBibleBlockMarkup(trimmed));
        index += 1;
        continue;
      }

      if (/^```/.test(trimmed)) {
        const code = [];
        index += 1;
        while (index < lines.length && !/^```/.test(lines[index].trim())) {
          code.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        html.push('<hr>');
        index += 1;
        continue;
      }

      if (/^\|.+\|$/.test(trimmed) && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
        const tableLines = [trimmed];
        index += 2;
        while (index < lines.length && /^\|.+\|$/.test(lines[index].trim())) {
          tableLines.push(lines[index].trim());
          index += 1;
        }
        html.push(tableToHtml(tableLines));
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }

      if (/^>\s?/.test(trimmed)) {
        const quote = [];
        while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
          quote.push(lines[index].trim().replace(/^>\s?/, ''));
          index += 1;
        }
        html.push(`<blockquote>${quote.map((item) => `<p>${inlineMarkdown(item)}</p>`).join('')}</blockquote>`);
        continue;
      }

      const listMatch = trimmed.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
      if (listMatch) {
        const ordered = /\d+[.)]/.test(listMatch[2]);
        const tag = ordered ? 'ol' : 'ul';
        const items = [];
        while (index < lines.length) {
          const itemMatch = lines[index].trim().match(/^([-*+]|\d+[.)])\s+(.+)$/);
          if (!itemMatch || /\d+[.)]/.test(itemMatch[1]) !== ordered) break;
          items.push(itemMatch[2]);
          index += 1;
        }
        html.push(`<${tag}>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${tag}>`);
        continue;
      }

      const paragraph = [trimmed];
      index += 1;
      while (
        index < lines.length &&
        lines[index].trim() &&
        !isBlockStart(lines[index]) &&
        !(index + 1 < lines.length && /^\|.+\|$/.test(lines[index].trim()) && isTableDivider(lines[index + 1]))
      ) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    }

    return html.join('\n');
  }

  function normalizeMarkdown(value) {
    return String(value || '')
      .replace(/\r\n?/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  function isBlockStart(line) {
    const trimmed = line.trim();
    return /^```/.test(trimmed) ||
      /^#{1,6}\s+/.test(trimmed) ||
      /^>\s?/.test(trimmed) ||
      /^(\s*)([-*+]|\d+[.)])\s+/.test(line) ||
      /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed);
  }

  function isTableDivider(line) {
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
  }

  function tableToHtml(tableLines) {
    const rows = tableLines.map(splitTableRow);
    const headers = rows[0] || [];
    const bodyRows = rows.slice(1);
    return `
      <table>
        <thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead>
        <tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    `;
  }

  function splitTableRow(line) {
    return line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  }

  function inlineMarkdown(value) {
    const tokens = [];
    let text = escapeHtml(value)
      .replace(/`([^`]+)`/g, (_, code) => token(tokens, `<code>${escapeHtml(code)}</code>`))
      .replace(/!\[([^\]]*)]\(([^)]+)\)/g, (_, alt, src) => {
        const safeSrc = safeUrl(src);
        return safeSrc ? token(tokens, `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(alt)}">`) : escapeHtml(alt);
      })
      .replace(/\[([^\]]+)]\(([^)]+)\)/g, (_, label, href) => {
        const safeHref = safeUrl(href);
        return safeHref ? token(tokens, `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener">${label}</a>`) : label;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');

    tokens.forEach((value, index) => {
      text = text.replace(`@@TOKEN_${index}@@`, value);
    });
    return text;
  }

  function token(tokens, value) {
    const key = `@@TOKEN_${tokens.length}@@`;
    tokens.push(value);
    return key;
  }

  function htmlToMarkdown(html) {
    const container = document.createElement('div');
    container.innerHTML = sanitizePastedHtml(html || '');

    function walk(node, context = {}) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\s+/g, ' ');
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      if (node.dataset?.editorInsertMarker === 'true' || node.classList?.contains('editor-insert-marker')) return '';

      const tag = node.tagName.toLowerCase();
      const children = () => Array.from(node.childNodes).map((child) => walk(child, context)).join('').trim();
      const text = children();

      if (tag === 'br') return '\n';
      if (tag === 'strong' || tag === 'b') return text ? `**${text}**` : '';
      if (tag === 'em' || tag === 'i') return text ? `_${text}_` : '';
      if (tag === 's' || tag === 'strike' || tag === 'del') return text ? `~~${text}~~` : '';
      if (tag === 'code') return text ? `\`${text}\`` : '';
      if (tag === 'a') {
        const href = safeUrl(node.getAttribute('href') || '');
        return href && text ? `[${text}](${href})` : text;
      }
      if (tag === 'img') {
        const src = safeUrl(node.getAttribute('src') || '');
        return src ? `![${node.getAttribute('alt') || ''}](${src})` : '';
      }
      if (isBibleElement(node)) {
        return `\n${scriptureBlockMarkup(
          node.dataset.reference || '',
          node.dataset.mode || 'quote',
          node.dataset.translation || 'kjv',
        )}\n\n`;
      }
      if (/^h[1-6]$/.test(tag)) return `\n${'#'.repeat(Number(tag[1]))} ${text}\n\n`;
      if (tag === 'blockquote') {
        return `\n${text.split('\n').filter(Boolean).map((line) => `> ${line.trim()}`).join('\n')}\n\n`;
      }
      if (tag === 'ul' || tag === 'ol') {
        return `\n${Array.from(node.children).filter((child) => child.tagName.toLowerCase() === 'li').map((child, index) => {
          const marker = tag === 'ol' ? `${index + 1}.` : '-';
          return `${marker} ${walk(child, { list: tag }).trim()}`;
        }).join('\n')}\n\n`;
      }
      if (tag === 'li') return Array.from(node.childNodes).map((child) => walk(child, context)).join('').trim();
      if (tag === 'table') return `\n${tableElementToMarkdown(node)}\n\n`;
      if (tag === 'pre') return `\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;
      if (tag === 'hr') return '\n---\n\n';
      if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
        return text ? `${text}\n\n` : '';
      }
      return text;
    }

    return normalizeMarkdown(
      Array.from(container.childNodes)
        .map((node) => walk(node))
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
    );
  }

  function sanitizePastedHtml(html) {
    return String(html || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/\s(?:class|style|id|lang|width|height|align|valign|face|size)="[^"]*"/gi, '')
      .replace(/\s(?:class|style|id|lang|width|height|align|valign|face|size)='[^']*'/gi, '');
  }

  function isBibleBlockMarkup(value) {
    return /^<div\s+[^>]*class=["'][^"']*\bbible-insert\b[^"']*["'][^>]*><\/div>$/i.test(value);
  }

  function sanitizeBibleBlockMarkup(value) {
    const container = document.createElement('div');
    container.innerHTML = value;
    const block = container.querySelector('.bible-insert');
    if (!block) return '';
    return scriptureBlockMarkup(
      block.getAttribute('data-reference') || '',
      block.getAttribute('data-mode') || 'quote',
      block.getAttribute('data-translation') || 'kjv',
    );
  }

  function isBibleElement(node) {
    return node.classList?.contains('bible-insert') || node.classList?.contains('scripture-block');
  }

  function tableElementToMarkdown(table) {
    const rows = Array.from(table.querySelectorAll('tr')).map((row) =>
      Array.from(row.children).map((cell) => cell.textContent.trim().replace(/\|/g, '\\|'))
    ).filter((row) => row.length);
    if (!rows.length) return '';
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
    const header = normalized[0];
    const divider = Array(width).fill('---');
    return [header, divider, ...normalized.slice(1)]
      .map((row) => `| ${row.join(' | ')} |`)
      .join('\n');
  }

  function cleanPastedText(value) {
    return normalizeMarkdown(value)
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\n{3,}/g, '\n\n');
  }

  function safeUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    if (/^(https?:|mailto:|tel:|\/|#)/i.test(url)) return url;
    return '';
  }

  async function renderBibleBlocks(container) {
    const blocks = [...container.querySelectorAll('.bible-insert:not([data-rendered])')];
    await Promise.all(blocks.map(renderBibleBlock));
  }

  async function renderBibleBlock(block) {
    const referenceText = block.dataset.reference || '';
    const mode = block.dataset.mode === 'comparison' ? 'comparison' : 'quote';
    const translation = block.dataset.translation === 'tgl' ? 'tgl' : 'kjv';
    const references = findBibleReferences(referenceText);

    block.dataset.rendered = 'true';
    block.setAttribute('contenteditable', 'false');
    block.classList.add('cms-bible-block', mode === 'comparison' ? 'scripture-comparison' : 'scripture-quote-block');
    block.innerHTML = `<p class="scripture-loading">Loading ${escapeHtml(referenceText)}...</p>`;

    if (!references.length) {
      block.innerHTML = `<p class="scripture-error">Could not read this reference: ${escapeHtml(referenceText)}</p>`;
      return;
    }

    try {
      if (mode === 'comparison') {
        const [kjv, tgl] = await Promise.all([loadBible('kjv'), loadBible('tgl')]);
        block.innerHTML = references.map((reference) => bibleComparisonHtml(reference, kjv, tgl)).join('');
      } else {
        const bible = await loadBible(translation);
        block.innerHTML = references.map((reference) => bibleQuoteHtml(reference, bible, translation)).join('');
      }
    } catch (_) {
      block.removeAttribute('data-rendered');
      block.innerHTML = `<p class="scripture-error">Could not load scripture text from /assets/bibles. Click Preview or reopen the article to try again.</p>`;
    }
  }

  async function loadBible(version) {
    if (!bibleCache[version]) {
      bibleCache[version] = fetch(BIBLE_SOURCES[version])
        .then((response) => {
          if (!response.ok) throw new Error('Bible file could not be loaded.');
          return response.text();
        })
        .then(parseBible);
    }
    return bibleCache[version];
  }

  function parseBible(xmlText) {
    const documentXml = new DOMParser().parseFromString(xmlText, 'application/xml');
    const parsed = {};
    documentXml.querySelectorAll('BIBLEBOOK').forEach((bookNode) => {
      const bookName = bookNode.getAttribute('bname');
      parsed[bookName] = {};
      bookNode.querySelectorAll('CHAPTER').forEach((chapterNode) => {
        const chapterNumber = Number(chapterNode.getAttribute('cnumber'));
        parsed[bookName][chapterNumber] = {};
        chapterNode.querySelectorAll('VERS').forEach((verseNode) => {
          parsed[bookName][chapterNumber][Number(verseNode.getAttribute('vnumber'))] = verseNode.textContent.trim();
        });
      });
    });
    return parsed;
  }

  function findBibleReferences(text) {
    const matches = [];
    BIBLE_ALIASES.forEach(([book, ...aliases]) => {
      [book, ...aliases].forEach((alias) => {
        const pattern = new RegExp(`(^|[^A-Za-z0-9])(${toBibleAliasRegex(alias)})\\.?\\s+(\\d{1,3})\\s*:\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?`, 'gi');
        let match = pattern.exec(text);
        while (match) {
          const start = match.index + (match[1] || '').length;
          matches.push({
            book,
            chapter: Number(match[3]),
            start: Number(match[4]),
            end: Number(match[5] || match[4]),
            label: `${book} ${match[3]}:${match[5] ? `${match[4]}-${match[5]}` : match[4]}`,
            index: start,
            priority: match[2].length,
          });
          match = pattern.exec(text);
        }
      });
    });

    return matches
      .sort((a, b) => a.index - b.index || b.priority - a.priority)
      .filter((match, index, list) => {
        const previous = list[index - 1];
        return !previous || match.index !== previous.index;
      });
  }

  function bibleQuoteHtml(reference, bible, translation) {
    return `
      <blockquote class="cms-bible-quote">
        <p class="scripture-block-label">${translation.toUpperCase()}</p>
        ${bibleVersesHtml(resolveBibleVerses(reference, bible))}
        <cite>${escapeHtml(reference.label)}</cite>
      </blockquote>
    `;
  }

  function bibleComparisonHtml(reference, kjv, tgl) {
    return `
      <section class="cms-bible-comparison">
        <p class="scripture-block-label">Translation comparison</p>
        <h3>${escapeHtml(reference.label)}</h3>
        <div class="cms-bible-grid">
          <div><strong>KJV</strong>${bibleVersesHtml(resolveBibleVerses(reference, kjv))}</div>
          <div><strong>TGL</strong>${bibleVersesHtml(resolveBibleVerses(reference, tgl))}</div>
        </div>
      </section>
    `;
  }

  function resolveBibleVerses(reference, bible) {
    const chapter = bible[reference.book]?.[reference.chapter];
    if (!chapter) return [];
    const verses = [];
    for (let number = reference.start; number <= reference.end; number += 1) {
      if (chapter[number]) verses.push({ number, text: chapter[number] });
    }
    return verses;
  }

  function bibleVersesHtml(verses) {
    if (!verses.length) return '<p class="scripture-error">Verse not found.</p>';
    return verses.map((verse) => `<p class="scripture-verse"><sup>${verse.number}</sup>${escapeHtml(verse.text)}</p>`).join('');
  }

  function toBibleAliasRegex(value) {
    return String(value)
      .replace(/\s+/g, ' ')
      .trim()
      .split('')
      .map((character) => (character === ' ' ? '\\s*' : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('');
  }

  // Updates a button's caption without destroying its icon element. Mirrors the
  // caption into aria-label so the button keeps an accessible name on narrow
  // screens, where the visible label is hidden and only the icon remains.
  function setButtonLabel(button, text) {
    if (!button) return;
    const label = button.querySelector('.button-label');
    if (label) {
      label.textContent = text;
      button.setAttribute('aria-label', text);
      return;
    }
    button.textContent = text;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value || '').replace(/["\\]/g, '\\$&');
  }

  async function prepareImageForUpload(file) {
    const maxBytes = 800 * 1024;
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    if (file.type === 'image/gif') {
      if (file.size > maxBytes) throw new Error('GIF images cannot be compressed here. Please choose an image below 800 KB.');
      return file;
    }
    if (file.size <= maxBytes) return file;

    const bitmap = await createImageBitmap(file);
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.82;
    let blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    while (blob.size > maxBytes && quality > 0.48) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    }
    if (blob.size > maxBytes) {
      throw new Error('This image is still above 800 KB after compression. Please choose a smaller image.');
    }

    const name = `${file.name.replace(/\.[^.]+$/, '') || 'featured-image'}.jpg`;
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not compress this image.'));
      }, type, quality);
    });
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
