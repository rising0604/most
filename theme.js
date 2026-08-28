/* 컬러 콘솔 — 보는 사람이 테마와 두 캐릭터의 메인색, 프로필 이미지를 정합니다.
 *
 * 저장은 localStorage(뷰어 브라우저)에만 합니다. 서버가 없으므로 원본 파일은 바뀌지 않고,
 * 각자 고른 설정은 그 사람에게만 남습니다.
 *
 * 첫 페인트 전에 색과 아바타를 입히는 일은 각 HTML <head> 의 인라인 스니펫이 담당합니다.
 * (apply_theme.js 가 주입합니다.) 이 파일은 그 뒤에 콘솔 UI를 붙입니다.
 */
(() => {
  "use strict";

  const STORAGE_KEY = "most-theme";
  const AVATAR_KEY = "most-avatars";
  const BRAND_KEY = "most-brand";
  const HASH_KEY = "theme";

  // 아바타를 이 크기로 줄여서 저장합니다. 화면에는 44~48px 로 뜨므로
  // 128px 면 고해상도 화면에서도 충분하고, WebP 로 5KB 안쪽에 들어갑니다.
  const AVATAR_SIZE = 128;

  const MODES = [
    { id: "light", label: "라이트" },
    { id: "dark", label: "다크" },
    { id: "auto", label: "시스템" },
  ];

  // 메인색은 선택 상태·포커스·검색 하이라이트 등 화면 전반에 쓰입니다.
  const MAIN = { id: "point", label: "메인" };

  // 표시 이름은 manifest 에서 읽습니다 (@Ghost_ATA 가 뒤쪽 로그에서 "윤시현").
  const CHARACTERS = [
    { id: "ghost", label: "고스트" },
    { id: "nomos", label: "노모스" },
  ];

  const ACCENTS = [MAIN, ...CHARACTERS];

  const accentLabel = id =>
    MANIFEST?.characters?.[id]?.label
      || ACCENTS.find(a => a.id === id)?.label
      || id;

  const root = document.documentElement;
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");

  // apply_theme.js 가 만들어 둔 세대 목록. 없으면 아바타 기능만 조용히 빠집니다.
  // 스크립트 순서에 기대지 않도록 run() 시점에 읽습니다.
  let MANIFEST = null;

  // —— 상태 ——

  const emptyState = () => ({
    mode: "auto",
    custom: { light: {}, dark: {} },
  });

  const isHex = value => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

  function normalize(raw) {
    const state = emptyState();
    if (!raw || typeof raw !== "object") return state;

    if (MODES.some(m => m.id === raw.mode)) state.mode = raw.mode;

    for (const mode of ["light", "dark"]) {
      const source = raw.custom?.[mode];
      if (!source || typeof source !== "object") continue;
      for (const accent of ACCENTS) {
        const value = source[accent.id];
        if (isHex(value)) state.custom[mode][accent.id] = value.toLowerCase();
      }
    }
    return state;
  }

  function readHash() {
    const match = location.hash.match(new RegExp(`${HASH_KEY}=([^&]+)`));
    if (!match) return null;
    try {
      return normalize(JSON.parse(atob(decodeURIComponent(match[1]))));
    } catch {
      return null;
    }
  }

  function readStorage() {
    try {
      return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch {
      return emptyState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 시크릿 모드 등 저장이 막힌 경우 — 현재 세션에만 적용됩니다. */
    }
  }

  let state = readHash() || readStorage();

  const resolvedMode = () =>
    state.mode === "auto" ? (darkQuery.matches ? "dark" : "light") : state.mode;

  // —— 적용 ——

  function apply() {
    const mode = resolvedMode();
    root.setAttribute("data-theme", mode);

    for (const accent of ACCENTS) {
      const value = state.custom[mode][accent.id];
      const property = `--accent-${accent.id}`;
      if (value) root.style.setProperty(property, value);
      else root.style.removeProperty(property);
    }

    // 캐릭터 색이 정해진 뒤에 읽어야 프리셋 기본값도 함께 반영됩니다.
    for (const id of ["ghost", "nomos"]) {
      const resolved = toHex(getComputedStyle(root).getPropertyValue(`--accent-${id}`));
      if (resolved) root.style.setProperty(`--on-${id}`, readableOn(resolved));
    }
  }

  // —— 아바타 ——

  function readAvatars() {
    try {
      const raw = JSON.parse(localStorage.getItem(AVATAR_KEY) || "{}");
      const clean = {};
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "string" && value.startsWith("data:image/")) clean[key] = value;
      }
      return clean;
    } catch {
      return {};
    }
  }

  let avatars = readAvatars();

  // 페어명·캐릭터 표시 이름. reader.js 와 같은 저장소를 씁니다.
  function readBrand() {
    try {
      const value = JSON.parse(localStorage.getItem(BRAND_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  let brand = readBrand();

  function saveBrand() {
    try {
      localStorage.setItem(BRAND_KEY, JSON.stringify(brand));
    } catch {
      /* 저장이 막히면 이번 방문에만 적용됩니다. */
    }
  }

  function saveAvatars() {
    try {
      localStorage.setItem(AVATAR_KEY, JSON.stringify(avatars));
      return null;
    } catch (error) {
      // 용량 초과가 가장 흔합니다. 저장은 못 해도 현재 세션에는 남습니다.
      return error.name === "QuotaExceededError"
        ? "저장 공간이 가득 찼습니다. 다른 이미지를 되돌린 뒤 다시 시도해 주세요."
        : "저장에 실패했습니다. 이번 방문에만 적용됩니다.";
    }
  }

  // 이 페이지가 쓰는 세대만 배경으로 덮어씁니다. 부트 스니펫과 같은 규칙입니다.
  function applyAvatars() {
    if (!MANIFEST) return;

    let rules = "";
    for (const [name, meta] of Object.entries(MANIFEST.characters)) {
      const gen = root.getAttribute(`data-gen-${name}`);
      const url = gen && avatars[`${name}:${gen}`];
      if (!url) continue;
      const at = `.ttobot-status[data-account="${meta.account}"] .ttobot-avatar`;
      rules += `${at}{background-image:url("${url}");background-size:cover;background-position:center}`;
      rules += `${at} img{visibility:hidden}`;
    }

    let style = document.getElementById("most-avatar-style");
    if (!rules) {
      style?.remove();
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = "most-avatar-style";
      document.head.appendChild(style);
    }
    style.textContent = rules;
  }

  // 정사각으로 가운데를 잘라 축소합니다. WebP 가 안 되는 브라우저는 PNG 로 떨어집니다.
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("이미지를 열지 못했습니다."));
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = AVATAR_SIZE;
          const context = canvas.getContext("2d");
          const side = Math.min(image.naturalWidth, image.naturalHeight);
          context.drawImage(
            image,
            (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side,
            0, 0, AVATAR_SIZE, AVATAR_SIZE
          );
          let url = canvas.toDataURL("image/webp", 0.85);
          if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/png");
          resolve(url);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 세대 → 그 세대를 쓰는 로그 목록. "02 = 7/12, 7/14, 7/28" 을 만들기 위한 것입니다.
  function logsUsing(character, gen) {
    if (!MANIFEST) return [];
    return Object.entries(MANIFEST.pages)
      .filter(([, gens]) => gens[character] === gen)
      .map(([page]) => page);
  }

  const prettyDate = page => {
    const match = page.match(/^(\d{2})(\d{2})(?:_(\d+))?\.html$/);
    if (!match) return page.replace(/\.html$/, "");
    const [, month, day, part] = match;
    return `${Number(month)}/${Number(day)}${part ? `(${Number(part)})` : ""}`;
  };

  // —— 색 읽기 ——

  function toHex(value) {
    const text = String(value || "").trim();

    const short = text.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();

    if (isHex(text)) return text.toLowerCase();

    const rgb = text.match(/^rgba?\(([^)]+)\)$/i);
    if (rgb) {
      const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
      if (parts.length === 3) {
        return "#" + parts
          .map(part => {
            const n = part.endsWith("%")
              ? Math.round(parseFloat(part) * 2.55)
              : Math.round(parseFloat(part));
            return Math.max(0, Math.min(255, n || 0)).toString(16).padStart(2, "0");
          })
          .join("");
      }
    }
    return null;
  }

  // 말풍선처럼 색을 통째로 깔 때, 그 위에 얹을 글자색을 고릅니다.
  // 흰색과 짙은 잉크 중 대비가 큰 쪽 — 사용자가 아무 색이나 골라도 읽힙니다.
  const INK = "#0d141d";

  function relativeLuminance(hex) {
    const channel = index => {
      const value = parseInt(hex.slice(index, index + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  }

  function readableOn(hex) {
    const background = relativeLuminance(hex);
    const onWhite = 1.05 / (background + 0.05);
    const onInk = (background + 0.05) / (relativeLuminance(INK) + 0.05);
    return onWhite >= onInk ? "#ffffff" : INK;
  }

  // 기본 팔레트 값을 알아내려면 인라인 오버라이드를 잠시 걷어내고 읽어야 합니다.
  function baseAccent(id) {
    const property = `--accent-${id}`;
    const override = root.style.getPropertyValue(property);
    if (override) root.style.removeProperty(property);
    const value = toHex(getComputedStyle(root).getPropertyValue(property));
    if (override) root.style.setProperty(property, override);
    return value || "#888888";
  }

  const effectiveAccent = id =>
    state.custom[resolvedMode()][id] || baseAccent(id);

  // —— 콘솔 UI ——

  const CONSOLE_CSS = `
    .most-theme-open {
      position: fixed; right: 1rem; bottom: 1rem; z-index: 9998;
      width: 2.75rem; height: 2.75rem; display: grid; place-items: center;
      padding: 0; cursor: pointer; font-size: 1.15rem; line-height: 1;
      color: var(--text); background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 50%;
      box-shadow: 0 2px 10px rgba(0,0,0,.14);
    }
    .most-theme-open:hover { border-color: var(--accent-point); }
    .most-theme-open:focus-visible,
    .most-theme :focus-visible { outline: 2px solid var(--accent-point); outline-offset: 2px; }

    .most-theme {
      position: fixed; right: 1rem; bottom: 4.4rem; z-index: 9999;
      width: min(20rem, calc(100vw - 2rem));
      max-height: min(34rem, calc(100vh - 6rem)); overflow-y: auto;
      padding: 1rem; font-family: var(--font-sans); font-size: .82rem; color: var(--text);
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); box-shadow: 0 8px 28px rgba(0,0,0,.18);
    }
    .most-theme[hidden] { display: none; }
    .most-theme h2 {
      margin: 0 0 .7rem; font-size: .72rem; font-weight: 600;
      letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted);
    }
    .most-theme-row { display: flex; flex-wrap: wrap; gap: .35rem; margin-bottom: .9rem; }
    .most-theme-chip {
      flex: 1 1 auto; padding: .45rem .5rem; cursor: pointer;
      font: inherit; color: var(--text); background: var(--bg-card-alt);
      border: 1px solid var(--border); border-radius: 7px; white-space: nowrap;
    }
    .most-theme-chip[aria-pressed="true"] {
      border-color: var(--accent-point); font-weight: 600;
      background: color-mix(in oklab, var(--accent-point) 14%, var(--bg-card));
    }
    .most-theme-hr { height: 1px; margin: .1rem 0 .9rem; background: var(--border); border: 0; }

    /* —— 캐릭터 메인색 —— */
    .most-theme-color { margin-bottom: 1rem; }
    .most-theme-color > h3 {
      display: flex; align-items: center; gap: .4rem;
      margin: 0 0 .45rem; font-size: .8rem; font-weight: 600;
    }
    .most-theme-color > h3 i {
      width: .7rem; height: .7rem; border-radius: 50%; background: currentColor;
    }
    .most-theme-entry { display: flex; gap: .35rem; align-items: center; }
    .most-theme-entry input[type="color"] {
      flex: 0 0 2.1rem; width: 2.1rem; height: 1.9rem; padding: 0; cursor: pointer;
      background: none; border: 1px solid var(--border); border-radius: 5px;
    }
    .most-theme-entry input[type="color"]::-webkit-color-swatch-wrapper { padding: 2px; }
    .most-theme-entry input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 3px; }
    .most-theme-entry input[type="text"] {
      flex: 1 1 0; min-width: 0; padding: .42rem .5rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8rem;
      color: var(--text); background: var(--bg-card-alt);
      border: 1px solid var(--border); border-radius: 5px; text-transform: lowercase;
    }
    .most-theme-entry input[type="text"][aria-invalid="true"] { border-color: #d4574e; }
    .most-theme-entry button {
      flex: 0 0 auto; padding: .42rem .55rem; cursor: pointer;
      font: inherit; font-size: .76rem; color: var(--text-muted);
      background: var(--bg-card-alt); border: 1px solid var(--border); border-radius: 5px;
    }
    .most-theme-entry button:hover { color: var(--text); border-color: var(--accent-point); }

    .most-theme-name { flex: 1 1 0; min-width: 0; }
    .most-theme-note { margin: .1rem 0 .9rem; color: var(--text-muted); font-size: .74rem; }

    /* —— 프로필 이미지 —— */
    .most-theme-toggle {
      display: flex; gap: .35rem; align-items: center; width: 100%;
      margin-bottom: .7rem; padding: 0; cursor: pointer;
      font: inherit; font-weight: 600; color: var(--text);
      background: none; border: 0; text-align: left;
    }
    .most-theme-toggle::before { content: "▸"; font-size: .7em; color: var(--text-muted); }
    .most-theme-toggle[aria-expanded="true"]::before { content: "▾"; }

    .most-theme-character { margin-bottom: .75rem; }
    .most-theme-character > span {
      display: block; margin-bottom: .35rem; color: var(--text-muted); font-size: .76rem;
    }
    .most-theme-slots { display: flex; flex-wrap: wrap; gap: .4rem; }
    .most-theme-slot {
      width: 3.4rem; padding: 0; cursor: pointer; font: inherit;
      background: none; border: 0; color: var(--text-muted);
    }
    .most-theme-slot > i {
      display: block; width: 2.6rem; height: 2.6rem; margin: 0 auto .15rem;
      background: var(--bg-card-alt) center/cover no-repeat;
      border: 1px solid var(--border); border-radius: 50%;
    }
    .most-theme-slot:hover > i { border-color: var(--accent-point); }
    .most-theme-slot[data-changed="true"] > i { border-color: var(--accent-point); border-width: 2px; }
    .most-theme-slot > b { display: block; font-size: .68rem; font-weight: 700; }
    .most-theme-slot > small { display: block; font-size: .58rem; line-height: 1.25; }
    .most-theme-link {
      padding: 0; margin-top: .2rem; cursor: pointer; font: inherit; font-size: .74rem;
      color: var(--text-muted); background: none; border: 0; text-decoration: underline;
    }
    .most-theme-link:hover { color: var(--accent-point); }

    .most-theme-actions { display: flex; gap: .35rem; margin-top: .3rem; }
    .most-theme-actions button {
      flex: 1 1 0; padding: .5rem; cursor: pointer;
      font: inherit; color: var(--text); background: var(--bg-card-alt);
      border: 1px solid var(--border); border-radius: 7px;
    }
    .most-theme-actions button:hover { border-color: var(--accent-point); }

    @media print { .most-theme, .most-theme-open { display: none !important; } }
  `;

  const colorField = (id, withName) => `
    <div class="most-theme-color" data-for="${id}">
      <h3><i></i>${accentLabel(id)}</h3>
      ${withName ? `
      <div class="most-theme-entry">
        <input type="text" class="most-theme-name" data-charname="${id}"
               maxlength="20" placeholder="이름" aria-label="${accentLabel(id)} 표시 이름">
      </div>` : ""}
      <div class="most-theme-entry">
        <input type="color" data-accent="${id}" aria-label="${accentLabel(id)} 색 고르기">
        <input type="text" data-hex="${id}" spellcheck="false"
               maxlength="7" placeholder="#000000" aria-label="${accentLabel(id)} 헥사코드">
        <button type="button" data-revert="${id}">되돌리기</button>
      </div>
    </div>
  `;

  function build() {
    const style = document.createElement("style");
    style.textContent = CONSOLE_CSS;
    document.head.appendChild(style);

    const opener = document.createElement("button");
    opener.type = "button";
    opener.className = "most-theme-open";
    opener.textContent = "🎨";
    opener.setAttribute("aria-label", "컬러 설정 열기");
    opener.setAttribute("aria-expanded", "false");

    const panel = document.createElement("section");
    panel.className = "most-theme";
    panel.hidden = true;
    panel.setAttribute("aria-label", "컬러 설정");
    panel.innerHTML = `
      <h2>테마</h2>
      <div class="most-theme-row">
        ${MODES.map(m =>
          `<button type="button" class="most-theme-chip" data-mode="${m.id}" aria-pressed="false">${m.label}</button>`
        ).join("")}
      </div>

      <hr class="most-theme-hr">

      <h2>메인 색</h2>
      ${colorField(MAIN.id)}
      <p class="most-theme-note">선택 상태, 포커스, 검색 하이라이트에 쓰입니다.</p>

      <hr class="most-theme-hr">

      <h2>캐릭터 색</h2>
      ${CHARACTERS.map(a => colorField(a.id, true)).join("")}
      <p class="most-theme-note" data-role="scope"></p>

      ${MANIFEST ? `
      <hr class="most-theme-hr">

      <button type="button" class="most-theme-toggle" data-toggle="avatars" aria-expanded="false">프로필 이미지</button>
      <div class="most-theme-avatars" hidden>
        ${Object.entries(MANIFEST.characters).map(([name, meta]) => `
          <div class="most-theme-character">
            <span>${meta.label}</span>
            <div class="most-theme-slots">
              ${meta.gens.map(gen => {
                const dates = logsUsing(name, gen).map(prettyDate).join(", ");
                return `<button type="button" class="most-theme-slot"
                        data-avatar="${name}:${gen}" data-changed="false"
                        title="${meta.label} ${gen}번 — ${dates || "사용 로그 없음"}"
                        aria-label="${meta.label} ${gen}번 이미지 교체. 사용 로그 ${dates || "없음"}"><i></i><b>${gen}</b><small>${dates}</small></button>`;
              }).join("")}
            </div>
          </div>
        `).join("")}
        <p class="most-theme-note" data-role="avatar"></p>
        <button type="button" class="most-theme-link" data-action="avatar-reset">전부 원래 이미지로</button>
      </div>
      ` : ""}

      <div class="most-theme-actions">
        <button type="button" data-action="reset">초기화</button>
        <button type="button" data-action="share">링크 복사</button>
      </div>
      <input type="file" accept="image/*" hidden data-role="picker">
    `;

    document.body.append(opener, panel);
    return { opener, panel };
  }

  // 목차에 세대 번호를 붙여, 콘솔의 프로필 번호와 로그를 이어 볼 수 있게 합니다.
  function stampIndex() {
    if (!MANIFEST) return;
    for (const link of document.querySelectorAll(".index-list a[href]")) {
      if (link.querySelector(".index-gen")) continue;
      const gens = MANIFEST.pages[link.getAttribute("href")];
      if (!gens) continue;

      const badge = document.createElement("span");
      badge.className = "index-gen";
      badge.innerHTML = Object.entries(gens)
        .map(([name, gen]) =>
          `<b data-character="${name}" title="${MANIFEST.characters[name].label} ${gen}번 프로필">${gen}</b>`)
        .join("");
      link.appendChild(badge);
    }
  }

  // 다른 탭이나 부모 창에서 설정이 바뀌면 곧바로 따라갑니다.
  // 리더의 스레드 칸(iframe)이 열린 채로 색을 바꿔도 즉시 반영되게 하는 것이 핵심입니다.
  function watchStorage(onChange) {
    window.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY) {
        state = readStorage();
        apply();
      } else if (event.key === AVATAR_KEY) {
        avatars = readAvatars();
        applyAvatars();
      } else if (event.key === BRAND_KEY) {
        brand = readBrand();
      } else {
        return;
      }
      onChange?.();
    });
  }

  // "2026년 7월 28일 오후 04:28" → 날짜 줄 + 시각 줄.
  // 원본 마크업은 한 덩어리라 여기서 나눕니다.
  function splitTimes() {
    for (const node of document.querySelectorAll(".ttobot-time")) {
      if (node.firstElementChild) continue;
      const match = node.textContent.trim()
        .match(/(\d+)년\s*(\d+)월\s*(\d+)일\s*(오전|오후)?\s*(\d{1,2}):(\d{2})/);
      if (!match) continue;

      const [, , month, day, meridiem, hour, minute] = match;
      node.textContent = "";
      const date = document.createElement("span");
      date.textContent = `${Number(month)}월 ${Number(day)}일`;
      const time = document.createElement("span");
      time.textContent = `${meridiem ? meridiem + " " : ""}${Number(hour)}:${minute}`;
      node.append(date, time);
    }
  }

  function run() {
    MANIFEST = window.MOST_MANIFEST || null;

    // 리더의 스레드 칸(iframe)에 실렸는지 알립니다. CSS 가 여백을 줄입니다.
    let inPane = false;
    try {
      inPane = window.self !== window.top;
    } catch {
      inPane = true;
    }
    if (inPane) {
      document.body.classList.add("in-pane");
      splitTimes();
    }

    apply();
    applyAvatars();
    stampIndex();

    // 스레드 칸에는 콘솔을 띄우지 않습니다 — 부모 페이지의 것과 겹칩니다.
    if (inPane) {
      watchStorage();
      return;
    }

    const { opener, panel } = build();
    const scopeNote = panel.querySelector('[data-role="scope"]');
    const avatarNote = panel.querySelector('[data-role="avatar"]');
    const avatarBox = panel.querySelector(".most-theme-avatars");
    const avatarToggle = panel.querySelector('[data-toggle="avatars"]');
    const picker = panel.querySelector('[data-role="picker"]');
    let pendingSlot = null;

    function syncColors() {
      for (const accent of ACCENTS) {
        const value = effectiveAccent(accent.id);
        panel.querySelector(`[data-accent="${accent.id}"]`).value = value;

        const hex = panel.querySelector(`[data-hex="${accent.id}"]`);
        if (document.activeElement !== hex) hex.value = value;
        hex.setAttribute("aria-invalid", "false");

        panel.querySelector(`.most-theme-color[data-for="${accent.id}"] h3`).style.color = value;

        panel.querySelector(`[data-revert="${accent.id}"]`).disabled =
          !state.custom[resolvedMode()][accent.id];

        const nameBox = panel.querySelector(`[data-charname="${accent.id}"]`);
        if (nameBox && document.activeElement !== nameBox) {
          nameBox.value = brand.names?.[accent.id] || "";
          nameBox.placeholder = MANIFEST?.characters?.[accent.id]?.names?.[0] || "이름";
        }
      }
      scopeNote.textContent =
        resolvedMode() === "dark"
          ? "다크 모드에 적용됩니다. 라이트 색은 따로 지정합니다."
          : "라이트 모드에 적용됩니다. 다크 색은 따로 지정합니다.";
    }

    // 슬롯 미리보기 — 바꾼 게 있으면 그 이미지를, 없으면 원본 파일을 보여줍니다.
    function syncAvatars() {
      if (!MANIFEST) return;
      let changed = 0;
      for (const button of panel.querySelectorAll("[data-avatar]")) {
        const key = button.dataset.avatar;
        const [name, gen] = key.split(":");
        const saved = avatars[key];
        button.querySelector("i").style.backgroundImage =
          `url("${saved || `images/${name}_${gen}.png`}")`;
        button.dataset.changed = String(Boolean(saved));
        if (saved) changed++;
      }
      const here = MANIFEST.pages[location.pathname.split("/").pop()];
      avatarNote.textContent = changed
        ? `${changed}개 바꿈 — 이 브라우저에만 저장됩니다.`
        : here
          ? "번호는 목차에 붙은 번호와 같습니다. 이 로그는 " +
            Object.entries(here)
              .map(([n, g]) => `${MANIFEST.characters[n].label} ${g}번`).join(", ") + "을 씁니다."
          : "번호는 목차에 붙은 번호와 같습니다. 칸을 누르면 이미지를 바꿉니다.";
    }

    function sync() {
      for (const button of panel.querySelectorAll("[data-mode]")) {
        button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
      }
      syncColors();
      syncAvatars();
    }

    function commit() {
      apply();
      save(state);
      sync();
    }

    function setAccent(id, value) {
      state.custom[resolvedMode()][id] = value.toLowerCase();
      commit();
    }

    opener.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      opener.setAttribute("aria-expanded", String(open));
      opener.setAttribute("aria-label", open ? "컬러 설정 닫기" : "컬러 설정 열기");
      if (open) sync();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !panel.hidden) {
        panel.hidden = true;
        opener.setAttribute("aria-expanded", "false");
        opener.focus();
      }
    });

    panel.addEventListener("click", event => {
      const target = event.target.closest("button");
      if (!target) return;

      if (target.dataset.mode) {
        state.mode = target.dataset.mode;
        commit();
        return;
      }

      if (target.dataset.revert) {
        delete state.custom[resolvedMode()][target.dataset.revert];
        commit();
        return;
      }

      if (target === avatarToggle) {
        const open = avatarBox.hidden;
        avatarBox.hidden = !open;
        avatarToggle.setAttribute("aria-expanded", String(open));
        if (open) syncAvatars();
        return;
      }

      if (target.dataset.avatar) {
        pendingSlot = target.dataset.avatar;
        picker.value = "";
        picker.click();
        return;
      }

      if (target.dataset.action === "avatar-reset") {
        avatars = {};
        saveAvatars();
        applyAvatars();
        syncAvatars();
        return;
      }

      if (target.dataset.action === "reset") {
        state = emptyState();
        commit();
        return;
      }

      if (target.dataset.action === "share") {
        const encoded = encodeURIComponent(btoa(JSON.stringify(state)));
        const url = `${location.origin}${location.pathname}#${HASH_KEY}=${encoded}`;
        const label = target.textContent;
        navigator.clipboard?.writeText(url)
          .then(() => { target.textContent = "복사됨"; })
          .catch(() => { target.textContent = "복사 실패"; })
          .finally(() => setTimeout(() => { target.textContent = label; }, 1400));
      }
    });

    panel.addEventListener("input", event => {
      const pickerId = event.target.dataset.accent;
      if (pickerId) {
        setAccent(pickerId, event.target.value);
        return;
      }

      const charId = event.target.dataset.charname;
      if (charId) {
        const value = event.target.value.trim();
        brand.names = brand.names || {};
        if (value) brand.names[charId] = value;
        else delete brand.names[charId];
        saveBrand();
        // 같은 문서 안에서는 storage 이벤트가 안 뜨므로 직접 알립니다.
        window.dispatchEvent(new CustomEvent("most-brand-change"));
        return;
      }

      const hexId = event.target.dataset.hex;
      if (!hexId) return;

      // 타이핑 중에는 유효한 값이 될 때만 반영하고, 아니면 표시만 해 둡니다.
      let text = event.target.value.trim();
      if (text && !text.startsWith("#")) text = "#" + text;
      const parsed = toHex(text);
      event.target.setAttribute("aria-invalid", String(!parsed));
      if (parsed) setAccent(hexId, parsed);
    });

    // 포커스를 벗어나면 입력칸을 실제 적용값으로 되돌립니다.
    panel.addEventListener("focusout", event => {
      if (event.target.dataset.hex) syncColors();
    });

    picker?.addEventListener("change", async () => {
      const file = picker.files?.[0];
      if (!file || !pendingSlot) return;
      const slot = pendingSlot;
      pendingSlot = null;

      avatarNote.textContent = "이미지를 줄이는 중…";
      try {
        avatars[slot] = await shrink(file);
        const problem = saveAvatars();
        applyAvatars();
        syncAvatars();
        if (problem) avatarNote.textContent = problem;
      } catch (error) {
        avatarNote.textContent = error.message;
      }
    });

    // 시스템 모드일 때 OS 설정이 바뀌면 즉시 따라갑니다.
    darkQuery.addEventListener("change", () => {
      if (state.mode !== "auto") return;
      apply();
      if (!panel.hidden) sync();
    });

    watchStorage(() => { if (!panel.hidden) sync(); });
    sync();

    // 공유 링크로 들어온 경우 그 팔레트를 이 브라우저에도 남깁니다.
    if (readHash()) save(state);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
