/* 모든 로그 HTML에 컬러 콘솔을 붙이고, 아바타 목록을 만들어 냅니다.
 *   실행:  .\apply_theme.ps1   (또는 node apply_theme.js — 한글 경로에선 Node가 크래시할 수 있음)
 *
 * 하는 일
 *   1. <html> 에 이 페이지가 쓰는 아바타 세대를 새깁니다 (data-gen-ghost="05" 등).
 *      → 부트 스니펫이 body 파싱 전에도 어떤 이미지를 갈아끼울지 알 수 있습니다.
 *   2. <head> 안, 스타일시트 링크 앞에 인라인 부트 스니펫을 넣습니다.
 *      → 첫 페인트 전에 색과 아바타를 입혀 번쩍임을 막습니다. 인라인이어야만 합니다.
 *   3. </body> 앞에 avatars.js + theme.js 를 붙입니다.
 *   4. avatars.js 를 생성합니다 — 캐릭터별 세대 목록과 날짜별 사용 현황.
 *
 * 로그 HTML은 CRLF, index.html 은 LF 라서 파일마다 줄바꿈을 감지해 맞춥니다.
 * 여러 번 돌려도 안전합니다 (부트 스니펫은 갱신, 나머지는 중복 방지).
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.env.MOST_ROOT || __dirname;
const MARK = "most-theme-boot";

const CHARACTERS = {
  ghost: { label: "고스트", account: "@Ghost_ATA" },
  nomos: { label: "노모스", account: "@NOMOS_ATA" },
};

const BOOT_LINES = [
  `  <script id="${MARK}">`,
  `    /* 저장된 테마와 아바타를 첫 페인트 전에 적용합니다. theme.js 가 나머지를 맡습니다. */`,
  `    (function () {`,
  `      var root = document.documentElement;`,
  `      function readable(hex) {`,
  `        var f = function (i) {`,
  `          var v = parseInt(hex.substr(i, 2), 16) / 255;`,
  `          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);`,
  `        };`,
  `        var L = 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5);`,
  `        return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0567 ? "#ffffff" : "#0d141d";`,
  `      }`,
  `      try {`,
  `        var hash = (location.hash.match(/theme=([^&]+)/) || [])[1];`,
  `        var raw = hash`,
  `          ? atob(decodeURIComponent(hash))`,
  `          : localStorage.getItem("most-theme") || "{}";`,
  `        var state = JSON.parse(raw) || {};`,
  `        var mode = state.mode || "auto";`,
  `        if (mode === "auto") {`,
  `          mode = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";`,
  `        }`,
  `        root.setAttribute("data-theme", mode);`,
  `        var custom = (state.custom || {})[mode] || {};`,
  `        for (var key in custom) {`,
  `          if (!/^#[0-9a-f]{6}$/i.test(custom[key])) continue;`,
  `          root.style.setProperty("--accent-" + key, custom[key]);`,
  `          if (key === "ghost" || key === "nomos") {`,
  `            /* 말풍선 글자색 — 흰색과 짙은 잉크 중 대비가 큰 쪽 */`,
  `            root.style.setProperty("--on-" + key, readable(custom[key]));`,
  `          }`,
  `        }`,
  `      } catch (e) {`,
  `        /* 저장이 막혀 있으면 CSS 기본 팔레트로 갑니다. */`,
  `      }`,
  `      try {`,
  `        /* 이 페이지가 쓰는 세대만 골라 배경으로 덮어씁니다. */`,
  `        var saved = JSON.parse(localStorage.getItem("most-avatars") || "{}");`,
  `        var rules = "";`,
  `        var accounts = { ghost: "@Ghost_ATA", nomos: "@NOMOS_ATA" };`,
  `        for (var name in accounts) {`,
  `          var gen = root.getAttribute("data-gen-" + name);`,
  `          var url = gen && saved[name + ":" + gen];`,
  `          if (!url || url.slice(0, 11) !== "data:image/") continue;`,
  `          var at = '.ttobot-status[data-account="' + accounts[name] + '"] .ttobot-avatar';`,
  `          rules += at + '{background-image:url("' + url + '");background-size:cover;background-position:center}';`,
  `          rules += at + " img{visibility:hidden}";`,
  `        }`,
  `        if (rules) {`,
  `          var style = document.createElement("style");`,
  `          style.id = "most-avatar-style";`,
  `          style.textContent = rules;`,
  `          document.head.appendChild(style);`,
  `        }`,
  `      } catch (e) {`,
  `        /* 아바타를 못 읽으면 원본 이미지가 그대로 보입니다. */`,
  `      }`,
  `    })();`,
  `  </script>`,
];

// ── 파일 훑기 ──

const files = fs
  .readdirSync(ROOT)
  .filter(name => name.endsWith(".html") && !name.startsWith("_"));

if (!files.length) {
  console.error("HTML 파일을 찾지 못했습니다.");
  process.exit(1);
}

const pages = {};
const gensByCharacter = {};
// 표시 이름은 로그마다 다를 수 있습니다 (@Ghost_ATA 가 뒤쪽 로그에서 "윤시현"). 데이터에서 모읍니다.
const namesByCharacter = {};
for (const name of Object.keys(CHARACTERS)) {
  gensByCharacter[name] = new Set();
  namesByCharacter[name] = new Map();
}

for (const name of files) {
  const html = fs.readFileSync(path.join(ROOT, name), "utf8");
  const found = {};
  for (const character of Object.keys(CHARACTERS)) {
    const hits = [...html.matchAll(new RegExp(`images/${character}_(\\d+)\\.png`, "g"))]
      .map(m => m[1]);
    if (!hits.length) continue;

    const unique = [...new Set(hits)];
    if (unique.length > 1) {
      console.warn(`  주의: ${name} 안에서 ${character} 세대가 섞여 있습니다 — ${unique.join(", ")}`);
    }
    found[character] = unique[0];
    for (const gen of unique) gensByCharacter[character].add(gen);

    const account = CHARACTERS[character].account;
    const shown = [...html.matchAll(
      new RegExp(`data-account="${account}">[\\s\\S]*?class="ttobot-name">([\\s\\S]*?)</div>`, "g")
    )].map(m => m[1].replace(/<[^>]*>/g, "").trim());
    for (const label of shown) {
      if (label) namesByCharacter[character].set(label, (namesByCharacter[character].get(label) || 0) + 1);
    }
  }
  if (Object.keys(found).length) pages[name] = found;
}

// ── 주입 ──

let injected = 0;
let skipped = 0;

for (const name of files) {
  const file = path.join(ROOT, name);
  let html = fs.readFileSync(file, "utf8");
  const before = html;

  // 이 파일이 쓰는 줄바꿈을 그대로 따라갑니다. 섞이면 diff 가 통째로 뒤집힙니다.
  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  const boot = BOOT_LINES.join(eol) + eol;

  // 1) <html> 에 이 페이지의 아바타 세대를 새깁니다.
  const gens = pages[name] || {};
  html = html.replace(/<html([^>]*)>/i, (_match, attrs) => {
    let cleaned = attrs.replace(/\s+data-gen-[a-z]+="[^"]*"/g, "");
    for (const [character, gen] of Object.entries(gens)) {
      cleaned += ` data-gen-${character}="${gen}"`;
    }
    return `<html${cleaned}>`;
  });

  // 2) 부트 스니펫 — 이미 있으면 최신 내용으로 갈아끼웁니다.
  const existing = new RegExp(`[ \\t]*<script id="${MARK}">[\\s\\S]*?</script>\\r?\\n`);
  if (existing.test(html)) {
    html = html.replace(existing, boot);
  } else {
    const link = html.match(/^[ \t]*<link[^>]+ttobot\.css[^>]*>[ \t]*\r?\n/m);
    if (link) {
      html = html.replace(link[0], boot + link[0]);
    } else if (/<\/head>/i.test(html)) {
      html = html.replace(/([ \t]*)<\/head>/i, `${boot}$1</head>`);
    } else {
      console.warn(`  건너뜀: ${name} — <head> 를 찾지 못했습니다.`);
      skipped++;
      continue;
    }
  }

  // 3) avatars.js + theme.js — theme.js 가 manifest 를 읽으므로 순서가 중요합니다.
  //    이미 있는 태그는 걷어내고 항상 이 순서로 다시 답니다.
  html = html.replace(
    /[ \t]*<script[^>]+src=["'](?:avatars|manifest|reader|theme)\.js["']\s*><\/script>[ \t]*\r?\n/g,
    ""
  );
  // manifest 는 항상 먼저. 리더는 목차 페이지에만 필요합니다.
  const scripts = ["manifest.js"];
  if (/class="[^"]*reader-page/.test(html)) scripts.push("reader.js");
  scripts.push("theme.js");

  const tags = scripts.map(src => `  <script src="${src}"></script>${eol}`).join("");
  html = /<\/body>/i.test(html)
    ? html.replace(/([ \t]*)<\/body>/i, `${tags}$1</body>`)
    : html + tags;

  if (html === before) {
    console.log(`  변경 없음: ${name}`);
    skipped++;
    continue;
  }

  fs.writeFileSync(file, html, "utf8");
  console.log(`  적용: ${name}  (${eol === "\r\n" ? "CRLF" : "LF"})${gens.ghost || gens.nomos ? `  세대 ${JSON.stringify(gens)}` : ""}`);
  injected++;
}

// ── manifest.js 생성 ──

const stripTags = html => html.replace(/<[^>]*>/g, "");

const decode = text => text
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

// "2026년 7월 04일 오후 10:09" → { month: 7, day: 4 }
function parseStamp(stamp) {
  const match = stamp.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
  if (!match) return null;
  return { year: +match[1], month: +match[2], day: +match[3] };
}

const logs = [];

for (const name of files) {
  if (name === "index.html") continue;

  const html = fs.readFileSync(path.join(ROOT, name), "utf8");
  const count = (html.match(/class="ttobot-status"/g) || []).length;
  if (!count) continue;

  const first = html.match(
    /<div class="ttobot-status" data-account="([^"]+)">([\s\S]*?)<div class="ttobot-time">([^<]*)<\/div>/
  );
  if (!first) {
    console.warn(`  주의: ${name} 첫 메시지를 읽지 못했습니다.`);
    continue;
  }

  const [, account, body, stamp] = first;
  const avatar = (body.match(/images\/[a-z0-9_]+\.png/) || [])[0] || "";
  const character = (avatar.match(/images\/([a-z]+)_/) || [])[1] || "";
  const speaker = decode(stripTags((body.match(/class="ttobot-name">([\s\S]*?)<\/div>/) || [])[1] || "")).trim();
  const text = decode(stripTags((body.match(/class="ttobot-content-text">([\s\S]*?)<\/div>/) || [])[1] || ""))
    .replace(/\s+/g, " ").trim();

  const when = parseStamp(stamp.trim());
  // 같은 날 로그가 둘이면 파일명 뒤 번호로 구분합니다 (0809_01 → 1편).
  const part = (name.match(/_(\d+)\.html$/) || [])[1];

  logs.push({
    file: name,
    month: when ? when.month : 0,
    day: when ? when.day : 0,
    part: part ? Number(part) : null,
    label: when
      ? `${when.month}월 ${when.day}일` + (part ? ` (${Number(part)}편)` : "")
      : name.replace(/\.html$/, ""),
    stamp: stamp.trim(),
    account,
    character,
    speaker,
    avatar,
    text,
    count,
    gens: pages[name] || {},
  });
}

logs.sort((a, b) => a.month - b.month || a.day - b.day || (a.part || 0) - (b.part || 0));

const manifest = { characters: {}, pages, logs };
for (const [name, meta] of Object.entries(CHARACTERS)) {
  // 많이 쓰인 순으로 정렬해, 이름이 바뀐 캐릭터는 둘 다 보여 줍니다.
  const shown = [...namesByCharacter[name].entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
  manifest.characters[name] = {
    label: shown.length ? shown.join(" · ") : meta.label,
    names: shown,
    account: meta.account,
    gens: [...gensByCharacter[name]].sort(),
  };
}

fs.writeFileSync(
  path.join(ROOT, "manifest.js"),
  "/* apply_theme.js 가 생성합니다 — 직접 고치지 마세요. */\n" +
    "window.MOST_MANIFEST = " + JSON.stringify(manifest, null, 2) + ";\n",
  "utf8"
);

// 이전 이름의 생성물이 남아 있으면 치웁니다.
const stale = path.join(ROOT, "avatars.js");
if (fs.existsSync(stale)) {
  fs.unlinkSync(stale);
  console.log("  제거: avatars.js (manifest.js 로 대체)");
}

console.log(`\nmanifest.js 생성 — 로그 ${logs.length}개, ` +
  Object.values(manifest.characters).map(v => `${v.label} ${v.gens.length}세대`).join(", "));
console.log(`완료 — 적용 ${injected}개, 건너뜀 ${skipped}개.`);
