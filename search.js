(() => {
  "use strict";

  const INDEX_PAGE = "index.html";
  const MESSAGE_SELECTOR = ".ttobot-content-text";
  const SEARCH_PARAM = "search";
  const MATCH_PARAM = "match";

  const logLinks = Array.from(
    document.querySelectorAll(".index-list a[href]")
  ).map((a) => ({
    href: a.getAttribute("href"),
    title: a.textContent.trim()
  }));

  const normalize = (text) =>
    (text || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("ko-KR");

  const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));

  const makeSnippet = (text, query) => {
    const source = text.replace(/\s+/g, " ").trim();
    const lowerSource = source.toLocaleLowerCase("ko-KR");
    const lowerQuery = query.toLocaleLowerCase("ko-KR");
    const index = lowerSource.indexOf(lowerQuery);

    if (index < 0) return escapeHtml(source.slice(0, 180));

    const start = Math.max(0, index - 75);
    const end = Math.min(source.length, index + query.length + 105);
    let snippet = source.slice(start, end);

    if (start > 0) snippet = "…" + snippet;
    if (end < source.length) snippet += "…";

    const escaped = escapeHtml(snippet);
    const q = escapeHtml(query);
    const highlighted = escaped.replace(
      new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      (m) => `<mark>${m}</mark>`
    );

    return highlighted;
  };

  function injectStyles() {
    if (document.getElementById("most-search-style")) return;

    const style = document.createElement("style");
    style.id = "most-search-style";
    style.textContent = `
      .most-search {
        margin: 0 0 1.5rem;
        padding: 1rem;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
      }

      .most-search-form {
        display: flex;
        gap: .5rem;
      }

      .most-search-input {
        flex: 1;
        min-width: 0;
        padding: .75rem .9rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--bg-card-alt);
        color: var(--text);
        font: inherit;
        outline: none;
      }

      .most-search-input:focus {
        border-color: var(--accent-c-yh);
      }

      .most-search-button {
        flex: 0 0 auto;
        padding: .75rem 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--bg-card-alt);
        color: var(--text);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .most-search-button:hover {
        border-color: var(--accent-c-yh);
      }

      .most-search-status {
        margin-top: .65rem;
        color: var(--text-muted);
        font-size: .85rem;
      }

      .most-search-results {
        display: flex;
        flex-direction: column;
        gap: .55rem;
        margin-top: .9rem;
      }

      .most-search-result {
        display: block;
        padding: .75rem .9rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text);
        text-decoration: none;
        background: var(--bg-card-alt);
      }

      .most-search-result:hover {
        border-color: var(--accent-c-yh);
      }

      .most-search-result-title {
        font-size: .8rem;
        color: var(--text-muted);
        margin-bottom: .25rem;
      }

      .most-search-result-text {
        line-height: 1.55;
      }

      .most-search mark {
        padding: 0 .1em;
        border-radius: 3px;
        background: #ffe66d;
        color: #222;
      }

      .most-search-highlight {
        outline: 3px solid #ffe66d !important;
        outline-offset: 3px;
        scroll-margin-top: 1rem;
      }

      @media (max-width: 480px) {
        .most-search-form {
          flex-direction: column;
        }

        .most-search-button {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createSearchBox() {
    if (!document.body.classList.contains("index-page")) return null;
    if (document.querySelector(".most-search")) return document.querySelector(".most-search");

    injectStyles();

    const wrap = document.createElement("section");
    wrap.className = "most-search";
    wrap.innerHTML = `
      <form class="most-search-form">
        <input
          class="most-search-input"
          type="search"
          placeholder="로그 내용 검색"
          autocomplete="off"
          aria-label="로그 내용 검색"
        >
        <button class="most-search-button" type="submit">검색</button>
      </form>
      <div class="most-search-status" aria-live="polite"></div>
      <div class="most-search-results"></div>
    `;

    const nav = document.querySelector(".index-nav");
    const wrapTarget = document.querySelector(".index-wrap");

    if (nav) wrapTarget.insertBefore(wrap, nav);
    else wrapTarget.prepend(wrap);

    return wrap;
  }

  async function searchLogs(query, box) {
    const status = box.querySelector(".most-search-status");
    const results = box.querySelector(".most-search-results");

    results.innerHTML = "";

    if (!query) {
      status.textContent = "검색어를 입력해 주세요.";
      return;
    }

    if (!logLinks.length) {
      status.textContent = "검색할 로그가 없습니다.";
      return;
    }

    status.textContent = `검색 중… 0 / ${logLinks.length}`;

    const found = [];

    await Promise.all(
      logLinks.map(async (log, fileIndex) => {
        try {
          const response = await fetch(log.href, { cache: "no-cache" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          const messages = Array.from(doc.querySelectorAll(MESSAGE_SELECTOR));

          messages.forEach((message, messageIndex) => {
            const text = message.textContent.trim();

            if (normalize(text).includes(normalize(query))) {
              const card = message.closest(".ttobot-status");
              const name =
                card?.querySelector(".ttobot-name")?.textContent.trim() || "";
              const time =
                card?.querySelector(".ttobot-time")?.textContent.trim() || "";

              found.push({
                fileIndex,
                href: log.href,
                title: log.title || doc.title || log.href,
                messageIndex,
                name,
                time,
                text
              });
            }
          });
        } catch (error) {
          console.error(`검색 실패: ${log.href}`, error);
        }

        status.textContent = `검색 중… ${fileIndex + 1} / ${logLinks.length}`;
      })
    );

    found.sort((a, b) => {
      if (a.fileIndex !== b.fileIndex) return a.fileIndex - b.fileIndex;
      return a.messageIndex - b.messageIndex;
    });

    if (!found.length) {
      status.textContent = `"${query}" 검색 결과가 없습니다.`;
      return;
    }

    status.textContent = `"${query}" 검색 결과 ${found.length}건`;

    const fragment = document.createDocumentFragment();

    found.forEach((item) => {
      const link = document.createElement("a");
      link.className = "most-search-result";
      link.href =
        `${item.href}?${SEARCH_PARAM}=${encodeURIComponent(query)}` +
        `&${MATCH_PARAM}=${item.messageIndex}`;

      link.innerHTML = `
        <div class="most-search-result-title">
          ${escapeHtml(item.title)}
          ${item.name ? ` · ${escapeHtml(item.name)}` : ""}
          ${item.time ? ` · ${escapeHtml(item.time)}` : ""}
        </div>
        <div class="most-search-result-text">
          ${makeSnippet(item.text, query)}
        </div>
      `;

      fragment.appendChild(link);
    });

    results.appendChild(fragment);
  }

  function initIndex() {
    const box = createSearchBox();
    if (!box) return;

    const form = box.querySelector(".most-search-form");
    const input = box.querySelector(".most-search-input");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      searchLogs(input.value.trim(), box);
    });

    const params = new URLSearchParams(location.search);
    const query = params.get(SEARCH_PARAM);

    if (query) {
      input.value = query;
      searchLogs(query, box);
    }
  }

  function initLogPage() {
    const params = new URLSearchParams(location.search);
    const query = params.get(SEARCH_PARAM);
    const matchIndex = Number.parseInt(params.get(MATCH_PARAM) || "", 10);

    if (!query || !Number.isInteger(matchIndex)) return;

    injectStyles();

    const messages = Array.from(document.querySelectorAll(MESSAGE_SELECTOR));
    const matches = messages.filter((message) =>
      normalize(message.textContent).includes(normalize(query))
    );

    const target = matches[matchIndex];

    if (!target) return;

    target.classList.add("most-search-highlight");

    requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initIndex();
      initLogPage();
    });
  } else {
    initIndex();
    initLogPage();
  }
})();
