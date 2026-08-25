(function () {
  const bibleSources = {
    kjv: "/assets/bibles/kjv/king-james-version.xml",
    tgl: "/assets/bibles/tgl/ang-dating-biblia.xml",
  };

  const books = [
    ["Genesis", "genesis", "gen"],
    ["Exodus", "exodus", "exod", "exo", "ex"],
    ["Leviticus", "leviticus", "lev"],
    ["Numbers", "numbers", "num", "nm"],
    ["Deuteronomy", "deuteronomy", "deut", "dt"],
    ["Joshua", "joshua", "josh"],
    ["Judges", "judges", "judg", "jdg"],
    ["Ruth", "ruth"],
    ["1 Samuel", "1 samuel", "1samuel", "1 sam", "1sam", "i samuel", "i sam"],
    ["2 Samuel", "2 samuel", "2samuel", "2 sam", "2sam", "ii samuel", "ii sam"],
    ["1 Kings", "1 kings", "1kings", "1 king", "1king", "i kings", "i king"],
    ["2 Kings", "2 kings", "2kings", "2 king", "2king", "ii kings", "ii king"],
    ["1 Chronicles", "1 chronicles", "1chronicles", "1 chr", "1chr", "i chronicles", "i chr"],
    ["2 Chronicles", "2 chronicles", "2chronicles", "2 chr", "2chr", "ii chronicles", "ii chr"],
    ["Ezra", "ezra"],
    ["Nehemiah", "nehemiah", "neh"],
    ["Esther", "esther", "esth"],
    ["Job", "job"],
    ["Psalms", "psalms", "psalm", "psa", "ps"],
    ["Proverbs", "proverbs", "prov", "pro"],
    ["Ecclesiastes", "ecclesiastes", "eccl", "ecc"],
    ["Song of Solomon", "song of solomon", "song", "sos", "canticles"],
    ["Isaiah", "isaiah", "isa"],
    ["Jeremiah", "jeremiah", "jer"],
    ["Lamentations", "lamentations", "lam"],
    ["Ezekiel", "ezekiel", "ezek"],
    ["Daniel", "daniel", "dan"],
    ["Hosea", "hosea", "hos"],
    ["Joel", "joel"],
    ["Amos", "amos"],
    ["Obadiah", "obadiah", "obad"],
    ["Jonah", "jonah"],
    ["Micah", "micah", "mic"],
    ["Nahum", "nahum", "nah"],
    ["Habakkuk", "habakkuk", "hab"],
    ["Zephaniah", "zephaniah", "zeph"],
    ["Haggai", "haggai", "hag"],
    ["Zechariah", "zechariah", "zech"],
    ["Malachi", "malachi", "mal"],
    ["Matthew", "matthew", "matt", "mat", "mateo"],
    ["Mark", "mark", "marcos", "mk"],
    ["Luke", "luke", "lucas", "lk"],
    ["John", "john", "juan", "jn"],
    ["Acts", "acts", "gawa"],
    ["Romans", "romans", "rom"],
    ["1 Corinthians", "1 corinthians", "1corinthians", "1 cor", "1cor", "i corinthians", "i cor"],
    ["2 Corinthians", "2 corinthians", "2corinthians", "2 cor", "2cor", "ii corinthians", "ii cor"],
    ["Galatians", "galatians", "gal"],
    ["Ephesians", "ephesians", "eph", "efeso", "efesios"],
    ["Philippians", "philippians", "phil"],
    ["Colossians", "colossians", "col"],
    ["1 Thessalonians", "1 thessalonians", "1thessalonians", "1 thess", "1thess", "i thessalonians", "i thess"],
    ["2 Thessalonians", "2 thessalonians", "2thessalonians", "2 thess", "2thess", "ii thessalonians", "ii thess"],
    ["1 Timothy", "1 timothy", "1timothy", "1 tim", "1tim", "i timothy", "i tim"],
    ["2 Timothy", "2 timothy", "2timothy", "2 tim", "2tim", "ii timothy", "ii tim"],
    ["Titus", "titus"],
    ["Philemon", "philemon", "philem"],
    ["Hebrews", "hebrews", "heb"],
    ["James", "james", "santiago", "jas"],
    ["1 Peter", "1 peter", "1peter", "1 pet", "1pet", "1 ped", "1ped", "i peter", "i pet", "i ped"],
    ["2 Peter", "2 peter", "2peter", "2 pet", "2pet", "2 ped", "2ped", "ii peter", "ii pet", "ii ped"],
    ["1 John", "1 john", "1john", "1 jn", "1jn", "i john", "i jn"],
    ["2 John", "2 john", "2john", "2 jn", "2jn", "ii john", "ii jn"],
    ["3 John", "3 john", "3john", "3 jn", "3jn", "iii john", "iii jn"],
    ["Jude", "jude", "judas"],
    ["Revelation", "revelation", "rev", "apocalipsis"],
  ];

  const aliasToBook = new Map();
  const aliasMatchers = [];
  const bookNumberToName = books.map(([book]) => book);

  books.forEach(([book, ...aliases]) => {
    [book, ...aliases].forEach((alias) => {
      aliasToBook.set(normalizeAlias(alias), book);
      aliasMatchers.push({
        book,
        pattern: new RegExp(
          `(^|[^A-Za-z0-9])(${toAliasRegex(alias)})\\.?\\s+(\\d{1,3})\\s*:\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?`,
          "gi"
        ),
      });
    });
  });

  const bibleCache = {};
  let current = null;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    const root = document.querySelector(
      "article .content, .post-content, main .content, #post-wrapper .content"
    );
    if (!root || root.dataset.scriptureAutolinkReady === "true") return;

    root.dataset.scriptureAutolinkReady = "true";
    renderBibleBlocks(root);
    linkReferences(root);
    root.addEventListener("click", onReferenceClick);
  }

  async function renderBibleBlocks(container) {
    const blocks = [...container.querySelectorAll(".bible-insert:not([data-rendered])")];
    await Promise.all(blocks.map(renderBibleBlock));
  }

  async function renderBibleBlock(block) {
    block.dataset.rendered = "true";
    block.innerHTML = `<p class="scripture-loading">Loading scripture...</p>`;

    const references = findReferences(block.dataset.reference || "");
    const mode = block.dataset.mode === "comparison" ? "comparison" : "quote";
    const translation = block.dataset.translation === "tgl" ? "tgl" : "kjv";

    if (!references.length) {
      block.innerHTML = `<p class="scripture-error">Scripture reference could not be read.</p>`;
      return;
    }

    block.classList.add("scripture-block", mode === "comparison" ? "scripture-comparison" : "scripture-quote-block");

    try {
      if (mode === "comparison") {
        const [kjv, tgl] = await Promise.all([loadBible("kjv"), loadBible("tgl")]);
        block.innerHTML = references.map((reference) => comparisonBlockHtml(reference, kjv, tgl)).join("");
      } else {
        const bible = await loadBible(translation);
        block.innerHTML = references.map((reference) => quoteBlockHtml(reference, bible, translation)).join("");
      }
    } catch (_) {
      block.innerHTML = `<p class="scripture-error">Scripture text could not be loaded.</p>`;
    }
  }

  function comparisonBlockHtml(reference, kjv, tgl) {
    return `
      <section class="scripture-comparison-card">
        <p class="scripture-block-label">Translation comparison</p>
        <h3>${escapeHtml(formatReference(reference))}</h3>
        <div class="scripture-comparison-grid">
          <div>
            <strong>KJV</strong>
            ${versesHtml(findVerses(kjv, toCurrentReference(reference)))}
          </div>
          <div>
            <strong>TGL</strong>
            ${versesHtml(findVerses(tgl, toCurrentReference(reference)))}
          </div>
        </div>
      </section>
    `;
  }

  function quoteBlockHtml(reference, bible, translation) {
    return `
      <blockquote class="scripture-quote-card">
        <p class="scripture-block-label">${translation.toUpperCase()}</p>
        ${versesHtml(findVerses(bible, toCurrentReference(reference)))}
        <cite>${escapeHtml(formatReference(reference))}</cite>
      </blockquote>
    `;
  }

  function versesHtml(verses) {
    if (!verses.length) return `<p class="scripture-error">Verse not found.</p>`;
    return verses
      .map((verse) => `<p class="scripture-verse"><sup>${verse.number}</sup>${escapeHtml(verse.text)}</p>`)
      .join("");
  }

  function toCurrentReference(reference) {
    return {
      book: reference.book,
      chapter: Number(reference.chapter),
      start: Number(reference.verse),
      end: Number(reference.endVerse),
      mode: "selection",
    };
  }

  function formatReference(reference) {
    const range = reference.verse === reference.endVerse ? reference.verse : `${reference.verse}-${reference.endVerse}`;
    return `${reference.book} ${reference.chapter}:${range}`;
  }

  function linkReferences(container) {
    const nodeFilter = window.NodeFilter || {
      SHOW_TEXT: 4,
      FILTER_ACCEPT: 1,
      FILTER_REJECT: 2,
    };

    const walker = document.createTreeWalker(container, nodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.match(/\d+\s*:/)) {
          return nodeFilter.FILTER_REJECT;
        }

        const parent = node.parentElement;
        if (!parent || parent.closest("a, button, pre, code, script, style, .scripture-ref")) {
          return nodeFilter.FILTER_REJECT;
        }

        return findReferences(node.nodeValue).length
          ? nodeFilter.FILTER_ACCEPT
          : nodeFilter.FILTER_REJECT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceNodeReferences);
  }

  function replaceNodeReferences(node) {
    const text = node.nodeValue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    const matches = findReferences(text);

    matches.forEach((reference) => {
      const { start, end, text: label, book, chapter, verse, endVerse } = reference;
      if (start > cursor) fragment.append(document.createTextNode(text.slice(cursor, start)));

      const button = document.createElement("button");
      button.type = "button";
      button.className = "scripture-ref";
      button.textContent = label;
      button.dataset.book = book;
      button.dataset.chapter = chapter;
      button.dataset.start = verse;
      button.dataset.end = endVerse || verse;
      fragment.append(button);

      cursor = end;
    });

    if (cursor === 0) return;
    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    node.parentNode.replaceChild(fragment, node);
  }

  function findReferences(text) {
    const matches = [];

    aliasMatchers.forEach(({ book, pattern }) => {
      pattern.lastIndex = 0;
      let match = pattern.exec(text);

      while (match) {
        const prefix = match[1] || "";
        const alias = match[2] || "";
        const start = match.index + prefix.length;
        const end = match.index + match[0].length;

        matches.push({
          start,
          end,
          text: text.slice(start, end),
          book,
          chapter: match[3],
          verse: match[4],
          endVerse: match[5] || match[4],
          priority: alias.length,
        });

        match = pattern.exec(text);
      }
    });

    return matches
      .sort((a, b) => a.start - b.start || b.priority - a.priority)
      .filter((match, index, list) => {
        const previous = list[index - 1];
        return !previous || match.start >= previous.end;
      });
  }

  async function onReferenceClick(event) {
    const button = event.target.closest(".scripture-ref");
    if (!button) return;

    current = {
      book: button.dataset.book,
      chapter: Number(button.dataset.chapter),
      start: Number(button.dataset.start),
      end: Number(button.dataset.end),
      version: "kjv",
      mode: "selection",
    };

    ensureDialog();
    openDialog();
    await renderCurrent();
  }

  async function loadBible(version) {
    if (!bibleCache[version]) {
      bibleCache[version] = fetch(bibleSources[version])
        .then((response) => {
          if (!response.ok) throw new Error("Bible file could not be loaded.");
          return response.text();
        })
        .then(parseBible);
    }

    return bibleCache[version];
  }

  function parseBible(xmlText) {
    const documentXml = new DOMParser().parseFromString(xmlText, "application/xml");
    const parsed = {};

    documentXml.querySelectorAll("BIBLEBOOK").forEach((bookNode) => {
      const rawBookName = bookNode.getAttribute("bname");
      const bookNumber = Number(bookNode.getAttribute("bnumber"));
      const bookName =
        bookNumberToName[bookNumber - 1] ||
        aliasToBook.get(normalizeAlias(rawBookName)) ||
        rawBookName;
      const chapters = {};

      parsed[bookName] = chapters;
      if (rawBookName && rawBookName !== bookName) parsed[rawBookName] = chapters;

      bookNode.querySelectorAll("CHAPTER").forEach((chapterNode) => {
        const chapterNumber = Number(chapterNode.getAttribute("cnumber"));
        chapters[chapterNumber] = {};

        chapterNode.querySelectorAll("VERS").forEach((verseNode) => {
          const verseNumber = Number(verseNode.getAttribute("vnumber"));
          chapters[chapterNumber][verseNumber] = verseNode.textContent.trim();
        });
      });
    });

    return parsed;
  }

  function ensureDialog() {
    if (document.querySelector(".scripture-overlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "scripture-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="scripture-card" role="dialog" aria-modal="true" aria-labelledby="scripture-title">
        <header class="scripture-card-header">
          <h2 id="scripture-title"></h2>
          <button type="button" class="scripture-close" aria-label="Close Bible popup">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </header>
        <div class="scripture-tabs" role="tablist" aria-label="Bible translation">
          <button type="button" class="active" data-version="kjv">KJV</button>
          <button type="button" data-version="tgl">TGL</button>
        </div>
        <div class="scripture-content" aria-live="polite"></div>
        <footer class="scripture-card-actions">
          <button type="button" class="scripture-chapter">
            <i class="fa-solid fa-book-open" aria-hidden="true"></i>
            <span class="scripture-button-text">View chapter</span>
          </button>
          <button type="button" class="scripture-copy">
            <i class="fa-regular fa-copy" aria-hidden="true"></i>
            <span class="scripture-button-text">Copy</span>
          </button>
        </footer>
      </section>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeDialog();
    });
    overlay.querySelector(".scripture-close").addEventListener("click", closeDialog);
    overlay.querySelector(".scripture-copy").addEventListener("click", copyCurrent);
    overlay.querySelector(".scripture-chapter").addEventListener("click", async () => {
      current.mode = current.mode === "chapter" ? "selection" : "chapter";
      await renderCurrent();
    });
    overlay.querySelectorAll("[data-version]").forEach((tab) => {
      tab.addEventListener("click", async () => {
        current.version = tab.dataset.version;
        current.mode = "selection";
        await renderCurrent();
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDialog();
    });
  }

  function openDialog() {
    const overlay = document.querySelector(".scripture-overlay");
    overlay.hidden = false;
    document.body.classList.add("scripture-open");
  }

  function closeDialog() {
    const overlay = document.querySelector(".scripture-overlay");
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("scripture-open");
  }

  async function renderCurrent() {
    const overlay = document.querySelector(".scripture-overlay");
    const title = overlay.querySelector("#scripture-title");
    const content = overlay.querySelector(".scripture-content");
    const chapterButton = overlay.querySelector(".scripture-chapter");

    title.textContent = formatTitle(current);
    content.innerHTML = `<p class="scripture-loading">Loading verse...</p>`;
    overlay.querySelectorAll("[data-version]").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.version === current.version);
    });
    chapterButton.innerHTML =
      current.mode === "chapter"
        ? `<i class="fa-solid fa-lines-leaning" aria-hidden="true"></i><span class="scripture-button-text">View selected verses</span>`
        : `<i class="fa-solid fa-book-open" aria-hidden="true"></i><span class="scripture-button-text">View chapter</span>`;

    try {
      const bible = await loadBible(current.version);
      const verses = findVerses(bible, current);
      if (!verses.length) {
        content.innerHTML = `<p class="scripture-error">This verse is not available in the selected Bible.</p>`;
        return;
      }

      content.innerHTML = verses
        .map(
          (verse) =>
            `<p class="scripture-verse"><sup>${verse.number}</sup>${escapeHtml(verse.text)}</p>`
        )
        .join("");
    } catch (error) {
      content.innerHTML = `<p class="scripture-error">We could not load the Bible text. Please try again.</p>`;
    }
  }

  function findVerses(bible, reference) {
    const chapter = bible[reference.book] && bible[reference.book][reference.chapter];
    if (!chapter) return [];

    const start = reference.mode === "chapter" ? 1 : reference.start;
    const end =
      reference.mode === "chapter"
        ? Math.max(...Object.keys(chapter).map(Number))
        : Math.max(reference.start, reference.end);
    const verses = [];

    for (let number = start; number <= end; number += 1) {
      if (chapter[number]) verses.push({ number, text: chapter[number] });
    }

    return verses;
  }

  async function copyCurrent() {
    const bible = await loadBible(current.version);
    const verses = findVerses(bible, current);
    const text = `${formatTitle(current)} ${verses
      .map((verse) => `${verse.number} ${verse.text}`)
      .join(" ")}`;

    await navigator.clipboard.writeText(text.trim());
    const copyButton = document.querySelector(".scripture-copy");
    copyButton.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i><span class="scripture-button-text">Copied</span>`;
    setTimeout(() => {
      copyButton.innerHTML = `<i class="fa-regular fa-copy" aria-hidden="true"></i><span class="scripture-button-text">Copy</span>`;
    }, 1400);
  }

  function formatTitle(reference) {
    const range = reference.start === reference.end ? reference.start : `${reference.start}-${reference.end}`;
    return `${reference.book} ${reference.chapter}:${range}`;
  }

  function normalizeAlias(value) {
    return value
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/\s+/g, "");
  }

  function toAliasRegex(value) {
    return value
      .replace(/\s+/g, " ")
      .trim()
      .split("")
      .map((character) => {
        if (character === " ") return "\\s*";
        return character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
