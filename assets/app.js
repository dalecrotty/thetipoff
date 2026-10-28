/* Drop Coverage — shared page logic. Vanilla JS, no deps. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- region: Australia or the US (brand plan, owner 15 Oct 2026) ----------
   On-page words, tip times, the price order and the help line follow the
   reader's region. Titles, URLs and what search engines index stay the
   Australian default: crawlers always get it. The region comes from the
   device's time zone (America/* is the US) until the reader picks one in
   the footer ("dc.region"). Prices are decimal in Australia and American
   for a US reader (owner, 15 Oct 2026: a .com sells to both). */
const REGION_KEY = "dc.region";
const US_ZONE = /^(America\/|US\/|Pacific\/Honolulu$)/;
const DEVICE_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
})();
const IS_BOT = /bot|crawl|spider|slurp|bingpreview|lighthouse|inspectiontool/i.test(navigator.userAgent || "");
const REGION = (() => {
  if (IS_BOT) return "au";
  try { const r = localStorage.getItem(REGION_KEY); if (r === "au" || r === "us") return r; } catch { /* default */ }
  return US_ZONE.test(DEVICE_TZ) ? "us" : "au";
})();
const US = REGION === "us";
/* the zone times are shown in: Sydney for Australia; for the US the
   device's own zone, or Eastern if the reader picked US from elsewhere.
   The schedule page is "NBA games in Australian time", so it stays AEDT. */
const SHOW_TZ = () => (!US || document.body?.dataset.page === "schedule") ? "Australia/Sydney"
  : (US_ZONE.test(DEVICE_TZ) ? DEVICE_TZ : "America/New_York");
const LOCALE = () => SHOW_TZ() === "Australia/Sydney" ? "en-AU" : "en-US";
function zoneName(d) {
  const z = (new Intl.DateTimeFormat(LOCALE(), { timeZone: SHOW_TZ(), timeZoneName: "short" })
    .formatToParts(d).find(p => p.type === "timeZoneName") || {}).value || "";
  return LOCALE() === "en-AU" ? z.replace(/^GMT\+11$/, "AEDT").replace(/^GMT\+10$/, "AEST")
    : z.replace(/^([ECMP])[SD]T$/, "$1T");                 // EDT -> ET
}
const dayIn = (d, tz) => new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "short" }).format(d);
/* the words that differ; the rest of the copy is shared */
const US_WORDS = [[/\bBookmakers\b/g, "Sportsbooks"], [/\bbookmakers\b/g, "sportsbooks"],
  [/\bBookmaker\b/g, "Sportsbook"], [/\bbookmaker\b/g, "sportsbook"],
  [/\bsame game multis\b/gi, "same game parlays"], [/\bsame game multi\b/gi, "same game parlay"],
  [/\bSGMs?\b/g, m => m.replace("SGM", "SGP")],
  [/Times in Australian eastern time\./g, "Times in your time zone."]];
function usWords(text) {
  let out = text;
  for (const [re, to] of US_WORDS) out = out.replace(re, to);
  return out;
}
/* decimal to American: 1.91 -> −110, 2.50 -> +150 (the minus is U+2212,
   as in the spreads) */
function american(dec) {
  const d = Number(dec);
  if (!isFinite(d) || d <= 1) return "—";
  const a = d >= 2 ? Math.round((d - 1) * 100) : -Math.round(100 / (d - 1));
  return a > 0 ? `+${a}` : `\u2212${-a}`;
}
const odds = dec => (dec === null || dec === undefined || isNaN(dec)) ? "—"
  : US ? american(dec) : Number(dec).toFixed(2);
/* each site lists its own region's books and their props (owner, 19 Oct
   2026): the rows carry the Australian book at the top level and the US
   book under "us"; on the US site the US block takes the top level, its
   chances and both prices too (22 Oct 2026: without them the US board set
   our chance against the Australian line beside the US one, and showed the
   Australian book's price under the US book's name) */
const LINE_KEYS = ["line", "side", "price", "book", "edge", "p_us", "p_book", "tier", "gate_status", "l10_over", "l5_over",
  "p_over", "p_under", "fair_over", "fair_under", "price_over", "price_under"];
function regionLines(rows) {
  if (!US) return rows;
  for (const r of rows || []) {
    const u = r.us || {};
    for (const k of LINE_KEYS) r[k] = u[k] === undefined ? null : u[k];
  }
  return rows;
}
/* the side we favour and its chance, from the line alone (owner, 19 Oct
   2026: rank by our chance of the side, not by one book's price). The
   edge is then the value at the region's reference book, and can be
   nil when the price doesn't pay for the chance. */
function favour(r) {
  if (!r || r.p_over == null) return r;
  const over = r.p_over >= 0.5;
  const raw = over ? r.p_over : (r.p_under != null ? r.p_under : 1 - r.p_over);
  const fair = over ? r.fair_over : r.fair_under;
  const sameSide = r.side === (over ? "over" : "under");
  r.side = over ? "over" : "under";
  /* the chance shown is ours pulled halfway to the bookmaker's (28 Oct 2026:
     the raw model chance overstates by 10-15 points through the 60-80%
     band; the pulled chance lands where it says and is what the graded
     props are picked on). The raw chance stays in the tooltip and in the
     edge, which is still ours minus the book's. */
  const chance = fair == null ? raw : +(0.5 * raw + 0.5 * fair).toFixed(4);
  r.chance = chance;
  r.p_us = raw;
  r.p_book = fair == null ? null : fair;
  r.price = over ? (r.price_over ?? r.price) : (r.price_under ?? r.price);
  r.edge = fair == null ? null : +(raw - fair).toFixed(4);
  if (!sameSide || r.edge == null || r.edge <= 0) { r.tier = null; if (r.edge != null && r.edge <= 0) r.gate_status = "no value"; }
  return r;
}
const favourLines = L => { for (const k of Object.keys(L || {})) favour(L[k]); return L; };
const BOOK_NAMES = { sportsbet: "Sportsbet", tab: "TAB", neds: "Neds", ladbrokes_au: "Ladbrokes", pointsbetau: "PointsBet",
  unibet: "Unibet", bet365_au: "bet365", fanduel: "FanDuel", draftkings: "DraftKings", betmgm: "BetMGM", williamhill_us: "Caesars",
  betrivers: "BetRivers", bovada: "Bovada", betonlineag: "BetOnline", pinnacle: "Pinnacle" };
const bookName = b => b ? (BOOK_NAMES[String(b).toLowerCase()] || String(b)) : "";
function regionPass(root) {
  if (!US || !root) return;
  // tip times written by the page builder: re-shown in the reader's zone
  const els = sel => [...(root.matches?.(sel) ? [root] : []), ...(root.querySelectorAll?.(sel) || [])];
  for (const t of els("time[datetime]")) {
    if (t.dataset.region || document.body.dataset.page === "schedule") continue;
    const d = new Date(t.getAttribute("datetime"));
    if (isNaN(d)) continue;
    if (t.dataset.when) {                          // the day and the time, both in the reader's zone
      const long = t.dataset.when === "long";
      const day = new Intl.DateTimeFormat("en-US", { timeZone: SHOW_TZ(), weekday: long ? "long" : "short",
        month: long ? "long" : "short", day: "numeric" }).format(d);
      t.textContent = `${long ? day : day.replace(/,/g, "")}${t.dataset.sep || ", "}${aedtTime(d.toISOString())} ${zoneName(d)}`;
      t.dataset.region = "us";
      continue;
    }
    const local = dayIn(d, SHOW_TZ()), syd = dayIn(d, "Australia/Sydney");
    t.textContent = t.hasAttribute("data-day") ? whenAEDT(d.toISOString())
      : `${local !== syd ? local + " " : ""}${aedtTime(d.toISOString())} ${zoneName(d)}`;
    t.dataset.region = "us";
  }
  // prices written by the page builder (<data class="odds">), in American
  for (const o of els("data.odds")) {
    if (o.dataset.region) continue;
    o.textContent = american(o.value);
    o.title = `decimal ${o.value}`;
    o.dataset.region = "us";
  }
  // words, in text and tooltips; the legal pages keep their wording
  if (document.querySelector("main.legal")) return;
  if (root.nodeType === 3) {                       // a lone text node
    if (!root.parentElement?.closest("script, style, textarea, [data-noregion]")) {
      const v = usWords(root.nodeValue);
      if (v !== root.nodeValue) root.nodeValue = v;
    }
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement?.closest("script, style, textarea, [data-noregion]")
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const v = usWords(n.nodeValue);
    if (v !== n.nodeValue) n.nodeValue = v;
  }
  for (const el of els("[title]")) {
    const v = usWords(el.title);
    if (v !== el.title) el.title = v;
  }
}

/* ---------- result stamps ----------
   COVERED / NOT COVERED belongs to graded results only (The Drop and
   the graded plays), never to projections (brand, 15 Oct 2026). The word
   carries the meaning; the colour backs it up. */
const stamp = r => r === "win" ? `<span class="stamp cov">Covered</span>`
  : r === "loss" ? `<span class="stamp nc">Not covered</span>`
  : r === "push" ? `<span class="stamp flat">Push</span>`
  : r === "void" ? `<span class="stamp flat">Void</span>` : "—";
/* ---------- day / night (owner, 15 Oct 2026) ----------
   Night is navy, day is maple and cream. A page follows the device until
   the reader picks; the pick is kept as "dc.mode" and applied before
   paint by the one-line script in each page's <head>. */
const MODE_KEY = "dc.mode";
const SUN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
  aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3
  M4.8 4.8l2.1 2.1M17.1 17.1l2.1 2.1M4.8 19.2l2.1-2.1M17.1 6.9l2.1-2.1"/></svg>`;
const MOON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M20.6 14.7A8.6 8.6 0 0 1 9.3 3.4a8.6 8.6 0 1 0 11.3 11.3z"/></svg>`;
const nightNow = () => {
  const t = document.documentElement.getAttribute("data-theme");
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};
function paintMode(btn) {
  const night = nightNow();
  for (const m of $$('meta[name="theme-color"]')) m.setAttribute("content", night ? "#16203A" : "#EAD7B2");
  const label = night ? "Switch to day mode" : "Switch to night mode";
  btn.innerHTML = night ? SUN : MOON;
  btn.setAttribute("aria-label", label);
  btn.title = label;
}
(function modeSwitch() {
  try { localStorage.removeItem("theme"); } catch { /* the old dark/light switch */ }
  const header = $("header.site");
  if (!header) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "modebtn";
  header.appendChild(btn);
  btn.addEventListener("click", () => {
    const next = nightNow() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* private window: this page only */ }
    paintMode(btn);
  });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  if (mq.addEventListener) mq.addEventListener("change", () => paintMode(btn));
  paintMode(btn);
})();

/* ---------- team identity ----------
   Colour + abbreviation per team, drawn as CSS/SVG. Deliberately NOT
   the official league logos: those are trademarks, and this is a
   public, betting-adjacent site. Team colours and three-letter codes
   carry the same at-a-glance recognition with none of that exposure,
   and they need no external assets (nothing to load, nothing to break).
   Keys are the BBD team strings the pipeline emits. */
const TEAM_META = {
  "Atlanta": ["ATL", "#e03a3e", "#26282a"], "Boston": ["BOS", "#007a33", "#ba9653"],
  "Brooklyn": ["BKN", "#1d1d1b", "#ffffff"], "Charlotte": ["CHA", "#1d1160", "#00788c"],
  "Chicago": ["CHI", "#ce1141", "#000000"], "Cleveland": ["CLE", "#860038", "#fdbb30"],
  "Dallas": ["DAL", "#00538c", "#b8c4ca"], "Denver": ["DEN", "#0e2240", "#fec524"],
  "Detroit": ["DET", "#c8102e", "#1d42ba"], "Golden State": ["GSW", "#1d428a", "#ffc72c"],
  "Houston": ["HOU", "#ce1141", "#c4ced4"], "Indiana": ["IND", "#002d62", "#fdbb30"],
  "LA Clippers": ["LAC", "#c8102e", "#1d428a"], "LA Lakers": ["LAL", "#552583", "#fdb927"],
  "Memphis": ["MEM", "#5d76a9", "#12173f"], "Miami": ["MIA", "#98002e", "#f9a01b"],
  "Milwaukee": ["MIL", "#00471b", "#eee1c6"], "Minnesota": ["MIN", "#0c2340", "#236192"],
  "New Orleans": ["NOP", "#0c2340", "#c8102e"], "New York": ["NYK", "#006bb6", "#f58426"],
  "Oklahoma City": ["OKC", "#007ac1", "#ef3b24"], "Orlando": ["ORL", "#0077c0", "#c4ced4"],
  "Philadelphia": ["PHI", "#006bb6", "#ed174c"], "Phoenix": ["PHX", "#1d1160", "#e56020"],
  "Portland": ["POR", "#e03a3e", "#000000"], "Sacramento": ["SAC", "#5a2d81", "#63727a"],
  "San Antonio": ["SAS", "#c4ced4", "#000000"], "Toronto": ["TOR", "#ce1141", "#000000"],
  "Utah": ["UTA", "#002b5c", "#f9a01b"], "Washington": ["WAS", "#002b5c", "#e31837"],
};

/* readable text on any jersey colour — luminance, not eyeballing */
function inkOn(hex) {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.42 ? "#12141a" : "#ffffff";
}

function teamMeta(team) {
  return TEAM_META[team] || [String(team || "").slice(0, 3).toUpperCase(),
                             "#667085", "#98a2b3"];
}

/** Small colour chip with the team code, in the team's colours — for
    table cells (owner, 19 Oct 2026: the chip makes the rows stand out). */
function teamBadge(team, { withName = false } = {}) {
  if (!team) return "";
  const [abbr, c1, c2] = teamMeta(team);
  return `<span class="tbadge" style="background:${c1};color:${inkOn(c1)};border-color:${c2}" title="${esc(team)}">${abbr}</span>` +
    (withName ? ` <span class="dim">${esc(team)}</span>` : "");
}

/** Singlet in team colours; shows the squad number when known, else the
    team code. Jersey numbers aren't in the spine yet — the shape is
    ready for them the day they are. */
function playerSinglet(team, number) {
  const [abbr, c1, c2] = teamMeta(team);
  const label = (number === undefined || number === null || number === "")
    ? abbr : String(number);
  return `<svg class="singlet" viewBox="0 0 44 46" role="img"
      aria-label="${esc(team)} singlet">
    <path d="M13 4 L22 9 L31 4 L41 9 L38 18 L34 16.5 V42 H10 V16.5 L6 18 L3 9 Z"
      fill="${c1}" stroke="${c2}" stroke-width="2" stroke-linejoin="round"/>
    <text x="22" y="32" text-anchor="middle" fill="${inkOn(c1)}"
      font-size="${label.length > 2 ? 11 : 15}" font-weight="800">${esc(label)}</text>
  </svg>`;
}

/* ---------- data + freshness ---------- */
async function loadJSON(path) {
  if (!path.startsWith("/") && !path.startsWith("http")) path = "/" + path;   // pages in subfolders too
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

/* Player links go to the player's name address (owner, 26 Oct 2026: "our
   URL is player IDs, not the player name"): data/player_pages.json maps id
   to /players/<name>.html, and "_full" says those are the full player
   pages. Before the first build that writes them, and for a player without
   one, the ID address (player.html?id=) stands. */
let PLAYER_PAGES = {};
const playerPagesReady = loadJSON("data/player_pages.json")
  .then(p => { if (p && p._full) PLAYER_PAGES = p; }).catch(() => {});
const pHref = id => PLAYER_PAGES[String(id)] || `/player.html?id=${id}`;

/* The members' data (api.html#members). The public file under /data
   carries the free columns; the full payload comes from the data endpoint,
   open to everyone until 1 December and then to members. If the endpoint
   is down or says members only, the page runs on the public file and the
   members' columns show as locked. */
const DATA_API = "https://gpupsgkyyldqyfemtjml.supabase.co/functions/v1/data";
window.DATA_LOCKED = false;
function memberToken() {
  try { return localStorage.getItem("dc.member_token") || ""; } catch { return ""; }
}
async function loadData(name) {
  const pub = loadJSON(name.startsWith("hub/") ? `data/player_hub/${name.slice(4)}.json` : `data/${name}.json`)
    .catch(() => null);
  let full = null;
  try {
    const r = await fetch(`${DATA_API}?name=${encodeURIComponent(name)}`, {
      headers: { "Authorization": `Bearer ${memberToken() || SIGNUP.key}` } });
    if (r.ok) full = await r.json();
    else if (r.status === 401 || r.status === 403) window.DATA_LOCKED = true;
  } catch { /* endpoint down: the public file stands */ }
  const p = await pub;
  if (full) return full;
  if (p) return p;
  throw new Error(`${name}: unavailable`);
}

/* Degraded mode (brief §5.2): the site must never show a blank page and
   must never let yesterday's numbers pass as today's. Two independent
   checks, because they catch different failures:
     status === "stale"  the run ran and failed, and said so in meta
     age > STALE_HOURS   the run never happened at all, so nothing was
                         there to mark it — the page has to notice itself
*/
const STALE_HOURS = 24;

function staleNotice(m) {
  const lastGood = m.last_ok_at || m.computed_at;
  if (m.status === "stale") {
    return `These are the numbers from <b>${whenAEDT(lastGood)}</b>. Tonight's run `
      + `did not complete, so nothing here has been updated since.`;
  }
  // Demo data is already labelled as a replay, so its age isn't news.
  if (m.demo) return null;
  const age = (Date.now() - Date.parse(m.computed_at)) / 3.6e6;
  if (Number.isFinite(age) && age > STALE_HOURS) {
    const ago = age > 48 ? `${Math.floor(age / 24)} days` : `${Math.floor(age)} hours`;
    return `These numbers were computed <b>${ago} ago</b> `
      + `(${whenAEDT(m.computed_at)}) and have not refreshed since.`;
  }
  return null;
}

/* "9:30am AEDT, Thu 8 Jan" in Australia; "7:30pm ET, Wed Oct 14" for a
   US reader (the region setting above) */
function whenAEDT(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || "";
  const day = new Intl.DateTimeFormat(LOCALE(), { timeZone: SHOW_TZ(),
    weekday: "short", day: "numeric", month: "short" }).format(d);
  return `${aedtTime(iso)} ${zoneName(d)}, ${day.replace(/,/g, "")}`;
}

async function renderFreshness() {
  try {
    const m = await loadJSON("data/meta.json");
    const el = $("#fresh");
    if (!el) return m;
    const build = { late: "late refresh near lock",
                    recalc: "updated after team news" }[m.build];
    const warn = staleNotice(m);
    el.classList.toggle("stale", !!warn);
    el.title = m.model_version || "";
    el.innerHTML =
      (warn ? `<div class="staleline"><b>Out of date.</b> ${warn}</div>` : "") +
      `<span>Updated <b>${whenAEDT(m.computed_at)}</b>${build ? ` · ${build}` : ""}</span>` +
      (US ? `<span>Lines from <b>US sportsbooks</b></span>`
          : `<span>Lines from <b>Australian bookmakers</b></span>`) +
      (m.demo ? `<span class="demo">Demo: last season's replay, not live</span>` : "");
    return m;
  } catch {
    const el = $("#fresh");
    if (el) {
      el.classList.add("stale");
      el.innerHTML = `<div class="staleline"><b>Out of date.</b> Today's `
        + `numbers could not be loaded. Nothing on this page is current.</div>`;
    }
    return null;
  }
}

/* ---------- table helpers ---------- */
const fmt = (v, dp = 1) => (v === null || v === undefined) ? "—"
  : (typeof v === "number" ? v.toFixed(dp) : v);
const pct = v => (v === null || v === undefined) ? "—" : (v * 100).toFixed(1) + "%";
/* "+1.43u", "−1u": the Drop's units (flat 1 unit each, owner 24 Oct 2026) */
const unitsTxt = v => (v === null || v === undefined) ? "—"
  : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2).replace(/\.?0+$/, "") + "u";
const unitsCls = v => v > 0 ? "pos" : v < 0 ? "neg" : "";
/* the Drop's projection in its side's colour: green over, red under (owner, 24 Oct 2026) */
const sideCls = side => side === "over" ? "ov" : side === "under" ? "un" : "";

function sortable(table, rows, render) {
  let key = null, dir = -1;
  $$("th[data-k]", table).forEach(th => th.onclick = () => {
    const k = th.dataset.k;
    dir = (key === k) ? -dir : -1;
    key = k;
    rows.sort(cmpBy(k, -dir));
    $$("th[data-k]", table).forEach(x => {
      x.classList.toggle("sorted", x === th);
      const base = x.dataset.label || (x.dataset.label = x.textContent.trim());
      x.textContent = x === th
        ? `${base} ${-dir === -1 ? "▾" : "▴"}` : base;
    });
    render();
  });
}

/* ---------- board page ---------- */
const COMBOS = ["PRA", "PR", "PA", "RA"];
const BOARD_STATS = ["PTS", "REB", "AST", "3PM", ...COMBOS, "STL", "BLK", "TOV"];
const TOP_N = 15;

/* per-stat sort state for the leader tables; survives re-renders so a
   filter change doesn't silently reset the column you chose */
const leaderSort = {};

const cmpBy = (k, dir) => (a, b) => {
  const x = a[k], y = b[k];
  if (x == null && y == null) return 0;
  if (x == null) return 1;                 // blanks last, either direction
  if (y == null) return -1;
  return (x < y ? -1 : x > y ? 1 : 0) * dir;
};

/* ---------- board cells ----------
   One meaning per colour: green = a real edge, or our side landing;
   orange = our prediction / movement; over and under are neutral. */
const STAT_WORD = { PTS: "points", REB: "rebounds", AST: "assists",
  "3PM": "threes", STL: "steals", BLK: "blocks", TOV: "turnovers",
  PRA: "pts + reb + ast", PR: "pts + reb", PA: "pts + ast", RA: "reb + ast" };

function playerCell(r) {
  const opp = r.opp ? ` v ${teamMeta(r.opp)[0]}` : "";
  return `<td class="s pl"><a href="${pHref(r.player_id)}">${esc(r.player)}</a>${moveInfo(r)}
    <div class="sm">${teamBadge(r.team)}${esc(opp)}${
      r.minutes != null ? ` · ${fmt(r.minutes, 0)} min` : ""}${
      r.minutes_source && r.minutes_source !== "model"
        ? ` <span class="badge src">${esc(r.minutes_source)}</span>` : ""}</div>${wwNote(r)}</td>`;
}
/* ranges (floor–ceiling) stay in the data but are not shown per player
   (owner, 6 Oct 2026); the track record reports how often they hold */
function predTd(r) {
  return `<td class="num pred">${predCell(r, true)}</td>`;
}
/* A side is called only on a clear edge (3%+; internal threshold, never shown as a tier). Below that, the value
   side can come from the price rather than the line — an under at 2.29
   with our prediction above the line — which reads as a contradiction. */
function lineTd(r) {
  if (r.line == null) return `<td class="num dim">—</td>`;
  return `<td class="num"><span class="side">${fmt(r.line)}</span>${
    r.price != null ? `<div class="sm" title="${r.book ? esc(bookName(r.book)) : ""}">@ ${odds(r.price)}</div>` : ""}</td>`;
}
function diffTd(r) {
  if (r.diff == null) return `<td class="num dim opt">—</td>`;
  return `<td class="num opt" title="our prediction minus the line, and as a % of the line">${
    r.diff > 0 ? "+" : ""}${fmt(r.diff)}<div class="sm">${
    r.diff_pct > 0 ? "+" : ""}${(r.diff_pct * 100).toFixed(0)}%</div></td>`;
}
function priceTd(r) {
  if (r.price == null) return `<td class="num dim">—</td>`;
  return `<td class="num">${odds(r.price)}${r.book
    ? `<div class="sm l">${esc(bookName(r.book))}</div>` : ""}</td>`;
}
/* Edge is one neutral number: our chance of the side minus the bookmaker's
   (margin removed) at the region's reference book, with the book and its
   price under it. The side and its chance live in the Chance column, so
   neither is repeated here (owner, 19 Oct 2026). On phones, where the Diff
   column is hidden, the diff shows under it. */
function chanceTd(r) {
  if (r.chance == null) return `<td class="num dim">—</td>`;
  const over = r.side === "over";
  const raw = r.p_us != null && r.p_book != null ? ` (our model ${Math.round(r.p_us * 100)}%, the bookmaker ${Math.round(r.p_book * 100)}%; the figure shown is halfway between, which is where results have landed)` : "";
  return `<td class="num" title="our chance that the ${r.side} ${fmt(r.line)} lands${raw}"><b class="${
    over ? "ov" : "un"}">${over ? "O" : "U"} ${Math.round(r.chance * 100)}%</b></td>`;
}
function edgeTd(r) {
  if (r.edge == null) return `<td class="num dim">—</td>`;
  const book = r.book ? esc(bookName(r.book)) : "";
  const price = r.price != null ? odds(r.price) : "";
  const diff = r.diff != null ? `<div class="sm ph">diff ${r.diff > 0 ? "+" : ""}${fmt(r.diff)}</div>` : "";
  if (r.edge <= 0)
    return `<td class="num"><span class="edge cold" title="the price at ${book || "the book"} doesn't pay for the chance">no value</span>${
      book ? `<div class="sm">${book} ${price}</div>` : ""}${diff}</td>`;
  const title = r.tier
    ? `Our chance of the ${r.side} ${fmt(r.line)} landing minus the bookmaker's (margin removed) at ${odds(r.price)}. Ours ${
        r.p_us != null ? Math.round(r.p_us * 100) + "%" : "—"}, the book's ${r.p_book != null ? Math.round(r.p_book * 100) + "%" : "—"}.`
    : "Below the threshold we'd call an edge";
  return `<td class="num"><span class="edge ${r.tier ? "hot" : "cold"}" title="${title}">+${Math.max(1, Math.round(r.edge * 100))}%</span>${
    book ? `<div class="sm">v ${book} ${price}</div>` : ""}${diff}</td>`;
}
function ordinal(n) {
  const t = n % 100, u = n % 10;
  return n + (t >= 11 && t <= 13 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th");
}
function muTd(r) {
  if (r.mu == null) return `<td class="num dim opt">—</td>`;
  const soft = r.mu_rank <= 10, hard = r.mu_rank > (r.mu_n || 30) - 10;
  return `<td class="num opt" title="${esc(r.opp || "Tonight's opponent")} give up ${
    r.mu > 0 ? "+" : ""}${(r.mu * 100).toFixed(0)}% ${STAT_WORD[r.stat] || r.stat} to his position vs the league — ${
    ordinal(r.mu_rank)} softest of ${r.mu_n || 30}"><span class="mu ${soft ? "soft" : hard ? "hard" : ""}">${
    r.mu > 0 ? "+" : ""}${(r.mu * 100).toFixed(0)}%</span><div class="sm">${ordinal(r.mu_rank)}</div></td>`;
}
function hitTd(r) {
  if (r.l10_hit == null) return `<td class="num dim opt">—</td>`;
  return `<td class="num opt"><span class="hit ${r.l10_hit >= 0.6 ? "good" : "meh"}"
    title="The ${r.lean} landed in ${(r.l10_hit * 100).toFixed(0)}% of his last 10">${
    (r.l10_hit * 100).toFixed(0)}%</span></td>`;
}

/* columns: [key, label, leftAligned, title, optional-on-phone] —
   the owner's Best Bets layout: prediction, line, the difference, and
   how often the side has landed. Price and edge % live on the full board. */
const LEADER_COLS = [
  ["player", "Player", true, ""],
  ["proj", "Pred", false, "our prediction"],
  ["line", "Line", false, "bookmaker line and price for the side we favour"],
  ["adiff", "Diff", false, "our prediction minus the line (sorts by size, overs and unders alike)", true],
  ["chance", "Chance", false, "how likely our side is to land: our model's chance pulled halfway to the bookmaker's (the ranking)"],
  ["edge", "Edge", false, "our chance minus the bookmaker's (margin removed) at the reference book: the value in the price"],
  ["mu", "Matchup", false, "what tonight's opponent gives up to his position, and its rank (1st = softest)", true],
  ["l10_hit", "Hit L10", false, "how often our side landed in his last 10 games", true],
];

/* How the boards are ordered. Edge is the default: it is the difference
   scaled by how much the player's number swings and by the price, so a
   2-point gap at 1.91 outranks a 2-point gap the bookmaker has already
   priced in at 1.64, and a 0.5 line can't win on percentage alone.
   Rows without a line fall to the bottom, biggest prediction first. */
const SORTS = { chance: "Chance", edge: "Edge", adiff: "Diff", adpct: "Diff %", proj: "Prediction" };
let boardSort = "chance";

function leaderTable(stat, rows, titled) {
  // the ACTIVE SORT COLUMN picks the population: default = the 15
  // biggest projections, sort by Diff = the 15 biggest gaps to the line,
  // etc. Nulls sort last, so rows with no line never occupy a slot.
  const s = leaderSort[stat] || { k: boardSort, dir: -1 };
  const top = rows.filter(r => r.stat === stat)
    .sort((a, b) => cmpBy(s.k, s.dir)(a, b) || (b.proj ?? 0) - (a.proj ?? 0))
    .slice(0, TOP_N);
  const head = LEADER_COLS.map(([k, label, left, title, opt]) =>
    `<th class="${left ? "s" : ""}${k === s.k ? " sorted" : ""}${opt ? " opt" : ""}"
        data-k="${k}"${title ? ` title="${title}"` : ""}>${label}${
      k === s.k ? (s.dir === -1 ? " ▾" : " ▴") : ""}</th>`).join("");
  const body = top.length ? top.map(r => `<tr>
        ${playerCell(r)}${predTd(r)}${lineTd(r)}${diffTd(r)}${chanceTd(r)}${edgeTd(r)}${muTd(r)}${hitTd(r)}
      </tr>`).join("")
    : `<tr><td colspan="8" class="empty">No players match.</td></tr>`;
  return `<div class="block" data-stat="${stat}">${titled
      ? `<div class="section"><h2>${STAT_WORD[stat] || stat}</h2></div>` : ""}
    <div class="tablewrap"><table class="board lead" data-stat="${stat}">
      <thead><tr>${head}</tr></thead><tbody>${body}</tbody>
    </table></div></div>`;
}

/* The page's answer in one sentence (brief §9): tonight's top points
   prediction, and the bookmaker line when there is one. */
function leadSentence(rows) {
  const pts = rows.filter(r => r.stat === "PTS" && r.proj != null)
    .sort((a, b) => b.proj - a.proj);
  const top = pts.find(r => r.line != null) || pts[0];
  if (!top) return "";
  const opp = top.opp ? ` against ${esc(top.opp)}` : "";
  const line = top.line != null
    ? `; the line is <span class="n">${fmt(top.line)}</span>${top.book ? ` at ${esc(bookName(top.book))}` : ""}` : "";
  return `<b>${esc(top.player)}</b> is predicted to score <span class="n">${
    fmt(top.proj)}</span> points${opp} tonight${line}.`;
}

/* ---------- CSV export (docs/csv-export.md) ----------
   One row per player, every market: our prediction and 80% range, the
   bookmaker's line and price (decimal) and the edge, + on the over and −
   on the under. The board's game / team / search filters decide the rows.
   Free until the members' gate goes on (1 Dec 2026), then members only:
   raw data free now, a reason to join later (owner, 16 Oct 2026). */
const CSV_MARKETS = [["PTS", "points"], ["REB", "rebounds"], ["AST", "assists"], ["3PM", "threes"],
  ["STL", "steals"], ["BLK", "blocks"], ["TOV", "turnovers"], ["PRA", "pra"], ["PR", "pr"], ["PA", "pa"], ["RA", "ra"]];
function boardCsv(rows, start) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.player_id)) by.set(r.player_id, { r, m: {} });
    by.get(r.player_id).m[r.stat] = r;
  }
  const q = v => v == null ? "" : /[",\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const n = (v, dp) => v == null || v === "" || isNaN(v) ? "" : Number(v).toFixed(dp);
  const tip = iso => {
    if (!iso) return "";
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric",
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso)).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  };
  const head = ["id", "last_name", "first_name", "full_name", "team", "position", "opponent", "tip_off_aedt",
    "status", "minutes", "book", ...CSV_MARKETS.flatMap(([, k]) =>
      [k, `${k}_low`, `${k}_high`, `${k}_line`, `${k}_price`, `${k}_edge`])];
  const out = [head.join(",")];
  for (const { r, m } of by.values()) {
    const name = String(r.player || "").split(" ");
    const book = bookName(Object.values(m).find(x => x.book)?.book || "");
    const row = [r.player_id, name.slice(1).join(" "), name[0], r.player, r.team, r.pos || "", r.opp || "",
      tip(start[r.game]), r.injury_status || "", n(r.minutes, 0), book];
    for (const [s] of CSV_MARKETS) {
      const x = m[s];
      const edge = x && x.edge != null ? (x.side === "under" ? -1 : 1) * x.edge * 100 : null;
      row.push(...(x ? [n(x.proj, 1), n(x.floor, 1), n(x.ceiling, 1), n(x.line, 1), n(x.price, 2), n(edge, 1)]
        : ["", "", "", "", "", ""]));
    }
    out.push(row.map(q).join(","));
  }
  return { text: "\ufeff" + out.join("\r\n"), players: by.size };   // the BOM: Excel reads UTF-8
}
function downloadFile(text, name, type = "text/csv;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function initBoard() {
  const meta = await renderFreshness();
  const data = await loadData("projections");
  let rows = regionLines(data.rows);
  rows.forEach(favour);
  // L10 from our side's point of view: an under that the player went
  // over in 4 of 10 landed 6 of 10
  rows.forEach(r => {
    r.diff = r.proj == null || r.line == null ? null : +(r.proj - r.line).toFixed(1);
    r.diff_pct = r.diff == null || !r.line ? null : r.diff / r.line;
    r.adiff = r.diff == null ? null : Math.abs(r.diff);
    r.adpct = r.diff_pct == null ? null : Math.abs(r.diff_pct);
    // the side we call on a real edge, else the way our prediction leans
    const lean = r.side || (r.diff == null ? null : r.diff >= 0 ? "over" : "under");
    r.lean = lean;
    r.l10_hit = r.l10_over == null || !lean ? null
      : (lean === "under" ? 1 - r.l10_over : r.l10_over);
  });
  renderMovers(data);
  const games = [...new Set(rows.map(r => r.game).filter(Boolean))].sort();
  $("#lead").innerHTML = leadSentence(rows);
  const lbl = $("#slateLbl");
  if (lbl) lbl.textContent = `${games.length} game${games.length === 1 ? "" : "s"} · ${
    new Set(rows.map(r => r.player_id)).size} players`;
  const tbody = $("#board tbody");
  const statSel = $("#fStat"), tierSel = $("#fTier"),
        teamSel = $("#fTeam"), gameSel = $("#fGame"), q = $("#fQ");
  [...new Set(rows.map(r => r.team).filter(Boolean))].sort().forEach(t => {
    const o = document.createElement("option");
    o.value = o.textContent = t;
    teamSel.append(o);
  });
  games.forEach(g => {
    const o = document.createElement("option");
    o.value = o.textContent = g;
    gameSel.append(o);
  });

  // leaders: one stat at a time, chosen by tab
  let stat = "PTS";
  $("#statTabs").innerHTML = BOARD_STATS.filter(s => rows.some(r => r.stat === s)).map(s =>
    `<button class="chip${s === stat ? " on" : ""}" data-s="${s}">${s}</button>`).join("");
  $("#statTabs").onclick = e => {
    const c = e.target.closest(".chip");
    if (!c) return;
    stat = c.dataset.s;
    $$(".chip", $("#statTabs")).forEach(x => x.classList.toggle("on", x.dataset.s === stat));
    render();
  };

  // markets tonight's data actually carries (older payloads have no combos)
  const present = new Set(rows.map(r => r.stat));
  const have = list => list.filter(s => present.has(s));
  const sortSel = $("#fSort");
  sortSel.innerHTML = Object.entries(SORTS).map(([k, l]) =>
    `<option value="${k}"${k === boardSort ? " selected" : ""}>Sort: ${l}</option>`).join("");
  sortSel.onchange = () => {
    boardSort = sortSel.value;
    Object.keys(leaderSort).forEach(k => delete leaderSort[k]);  // one order for every board
    rows.sort((a, b) => cmpBy(boardSort, -1)(a, b) || (b.proj ?? 0) - (a.proj ?? 0));
    render();
  };

  // wide screens: the four main markets side by side, the rest behind a
  // toggle; phones: one market at a time from the tabs
  const wide = matchMedia("(min-width: 900px)");
  wide.addEventListener("change", () => render());
  let others = false;

  // leader tables sort independently, per stat
  $("#leaders").onclick = e => {
    const more = e.target.closest("#moreBtn");
    if (more) { others = !others; render(); return; }
    const th = e.target.closest("th[data-k]");
    if (!th) return;
    const stat = th.closest("table").dataset.stat;
    const cur = leaderSort[stat] || { k: boardSort, dir: -1 };
    leaderSort[stat] = { k: th.dataset.k,
                         dir: cur.k === th.dataset.k ? -cur.dir : -1 };
    render();
  };

  let view = "leaders";
  $("#viewChips").onclick = e => {
    const c = e.target.closest(".chip");
    if (!c) return;
    view = c.dataset.v;
    $$(".chip", $("#viewChips")).forEach(x =>
      x.classList.toggle("on", x.dataset.v === view));
    $("#leadersWrap").hidden = view !== "leaders";
    $("#fullboard").hidden = view !== "full";
    render();
  };

  // shared filters (game / team / search) apply to both views
  const shared = r => {
    const tm = teamSel.value, gm = gameSel.value,
          needle = q.value.toLowerCase();
    return (tm === "all" || r.team === tm) &&
           (gm === "all" || r.game === gm) &&
           (!needle || r.player.toLowerCase().includes(needle));
  };

  const render = () => {
    const base = rows.filter(shared);
    if (view === "leaders") {
      $("#statTabs").hidden = wide.matches;
      $("#leaders").innerHTML = wide.matches
        ? `<div class="grid2">${["PTS", "REB", "AST", "3PM"].map(s =>
            leaderTable(s, base, true)).join("")}</div>
           ${have(COMBOS).length ? `<div class="grid2">${have(COMBOS).map(s =>
            leaderTable(s, base, true)).join("")}</div>` : ""}
           <button class="chip" id="moreBtn">${others ? "Hide" : "Show"} steals, blocks, turnovers</button>
           ${others ? `<div class="grid2 grid3">${["STL", "BLK", "TOV"].map(s =>
             leaderTable(s, base, true)).join("")}</div>` : ""}`
        : leaderTable(stat, base, false);
      return;
    }
    const s = statSel.value, t = tierSel.value;
    const view_ = base.filter(r =>
      (s === "all" || r.stat === s) &&
      (t === "all" || (t === "gated" && r.tier)));
    renderFull(view_);
  };

  const renderFull = view => {
    tbody.innerHTML = view.map(r => `<tr>
      ${playerCell(r)}
      <td class="s" data-stat="${r.stat}"><span class="side mkt">${r.stat}</span></td>
      ${predTd(r)}${lineTd(r)}${diffTd(r)}${chanceTd(r)}${edgeTd(r)}${muTd(r)}${hitTd(r)}
    </tr>`).join("") || `<tr><td colspan="10" class="empty">No rows match.</td></tr>`;
  };

  [statSel, tierSel, teamSel, gameSel].forEach(el => el.onchange = render);
  q.oninput = render;
  // a game or team in the address: the home strip and game pages link here
  const want = new URLSearchParams(location.search);
  const wg = want.get("game"), wt = want.get("team");
  if (wg && games.includes(wg)) {
    gameSel.value = wg;
    loadData("games").then(gd => {
      const g = (gd?.games || []).find(x => `${x.home} vs ${x.away}` === wg);
      if (g && g.url) $("#lead").insertAdjacentHTML("afterend",
        `<p class="sub"><a href="${gameHref(g)}">${esc(nick(g.away))} v ${esc(nick(g.home))}: the game page →</a></p>`);
    }).catch(() => {});
  }
  else if (wt && [...teamSel.options].some(o => o.value === wt)) teamSel.value = wt;
  const csvBtn = $("#csvBtn");
  if (csvBtn) {
    if (window.DATA_LOCKED) { csvBtn.textContent = "CSV: members"; csvBtn.title = "The CSV export is part of membership"; }
    csvBtn.onclick = async () => {
      if (window.DATA_LOCKED) { location.href = "/api.html#members"; return; }
      const gd = await loadData("games").catch(() => null);
      const start = {};
      (gd?.games || []).forEach(g => { start[`${g.home} vs ${g.away}`] = g.start; });
      const { text, players } = boardCsv(rows.filter(shared), start);
      const day = (meta && meta.slate_date) || new Date().toISOString().slice(0, 10);
      downloadFile(text, `dropcoverage-predictions-${day}.csv`);
      window.dcEvent?.("export_csv", { players });
    };
  }
  sortable($("#board"), rows, render);
  // default: biggest edge first; rows without a line after, by prediction
  rows.sort((a, b) => cmpBy(boardSort, -1)(a, b) || (b.proj ?? 0) - (a.proj ?? 0));
  render();
}


/* ---------- movement since the morning (brief §5.4) ----------
   "22.4 at 9am → 25.1, Jokic out". The prior is the day's first run;
   times are shown in Australian Eastern time, or a US reader's own. */
function aedtTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const parts = new Intl.DateTimeFormat(LOCALE(), {
    timeZone: SHOW_TZ(), hour: "numeric", minute: "2-digit",
    hour12: true }).formatToParts(d);
  const get = t => (parts.find(p => p.type === t) || {}).value || "";
  const mins = get("minute");
  return `${get("hour")}${mins === "00" ? "" : ":" + mins}${get("dayPeriod").toLowerCase().replace(/\./g, "")}`;
}

/* With/without: a key teammate is out tonight, and this player's own
   per-game shift without him, for this stat — shown as information
   ("Doncic out: +9.9 without him, 16 games"). The model keeps it out of
   the prediction until it proves itself against closing lines. */
function wwNote(r) {
  // tonight's role, when it differs from his usual position
  const role = r.pos && r.pos_usual && r.pos !== r.pos_usual
    ? `<div class="ww" title="${esc(r.player)} matches up as a ${esc(r.pos)} tonight (usually ${esc(r.pos_usual)}), so the ${esc(r.pos)} matchup numbers are used.">${esc(r.pos)} tonight (usually ${esc(r.pos_usual)})</div>`
    : "";
  const early = r.early != null
    ? `<div class="ww" title="Fewer than 10 NBA games: an early estimate built from his own games and the typical rookie at his position, with wider ranges. Not used for edges yet.">early estimate · ${r.early} NBA game${r.early === 1 ? "" : "s"}</div>`
    : "";
  if (!r.ww || !r.ww.length) return role + early;
  return r.ww.map(w => {
    const d = w.delta, sign = d > 0 ? "+" : "";
    const last = String(w.star).split(" ").slice(-1)[0];
    return `<div class="ww" title="${esc(w.star)} out tonight. ${esc(r.player)} has averaged ${sign}${fmt(d)} ${r.stat} per game without him (${w.n} games) compared with with him.">${esc(last)} out: ${sign}${fmt(d)} without him (${w.n} g)</div>`;
  }).join("") + role + early;
}

/* A moved prediction shows its arrow and an "i"; the note ("was 23.3 at
   4:46am, Jokic out") sits behind it, on hover or tap, so the row stays
   one line on a phone (owner, 6 Oct 2026). */
function predCell(r, bold) {
  return bold ? `<b>${fmt(r.proj)}</b>` : fmt(r.proj);
}
/* a moved prediction: the arrow and the "i" sit together next to the
   player's name, and hovering either says what moved, from what, when and
   why (owner, 19 Oct 2026) */
function moveInfo(r) {
  if (r.prior == null || r.proj == null) return "";
  const up = r.proj > r.prior;
  const was = `Prediction moved ${up ? "up" : "down"}: ${fmt(r.prior)} at ${aedtTime(r.prior_at)} to ${fmt(r.proj)} now${
    r.move_reason ? ` · ${r.move_reason}` : ""}`;
  return `<span class="info mvwrap" role="button" tabindex="0" aria-label="${esc(was)}" data-tip="${esc(was)}"><span class="mv ${
    up ? "up" : "down"}">${up ? "▲" : "▼"}</span><span class="i">i</span></span>`;
}
/* one floating note for every "i" on the page: hover shows it, tap toggles it */
addEventListener("DOMContentLoaded", () => {
  const tip = document.createElement("div");
  tip.className = "infotip"; tip.hidden = true;
  document.body.append(tip);
  let open = null;
  const show = el => {
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const r = el.getBoundingClientRect();
    tip.style.top = `${r.bottom + scrollY + 6}px`;
    tip.style.left = `${Math.max(8, Math.min(r.left + scrollX, innerWidth - tip.offsetWidth - 8))}px`;
  };
  const hide = () => { tip.hidden = true; open = null; };
  document.addEventListener("mouseover", e => { const el = e.target.closest(".info"); if (el && !open) show(el); });
  document.addEventListener("mouseout", e => { if (e.target.closest(".info") && !open) hide(); });
  document.addEventListener("click", e => {
    const el = e.target.closest(".info");
    if (el) { e.preventDefault(); if (open === el) hide(); else { show(el); open = el; } }
    else if (open) hide();
  });
});

function renderMovers(data) {
  const el = $("#movers");
  if (!el) return;
  const m = data.movers || [];
  const ups = (data.updates || []).map(u => aedtTime(u.run_at)).filter(Boolean);
  if (!m.length) { el.hidden = true; return; }
  el.hidden = false;
  const CAP = 6;
  const more = m.length > CAP;
  el.innerHTML = `<div class="section"><h2>Since this morning</h2></div>
    <p class="sub">Predictions that moved after news. Updated ${
      ups.join(", ")} (${zoneName(new Date())}).${more ? ` <a href="#" id="moversAll">All ${m.length} →</a>` : ""}</p>
    <div class="tablewrap"><table><tbody>${m.map((r, i) => `<tr${i >= CAP ? ' class="more" hidden' : ""}>
      <td class="s"><a href="${pHref(r.player_id)}">${esc(r.player)}</a></td>
      <td class="s">${teamBadge(r.team)}</td>
      <td class="s">${r.stat}</td>
      <td class="num dim">${fmt(r.prior)}</td>
      <td class="num">→ <b>${fmt(r.now)}</b></td>
      <td class="num"><span class="mv ${r.delta > 0 ? "up" : "down"}">${
        r.delta > 0 ? "+" : ""}${fmt(r.delta)}</span></td>
      <td class="s">${esc(r.reason)}</td>
    </tr>`).join("")}</tbody></table></div>`;
  const all = $("#moversAll");
  if (all) all.onclick = e => { e.preventDefault(); $$("tr.more", el).forEach(t => t.hidden = false); all.remove(); };
}

/* ---------- prop chart (player hub) ---------- */
const esc = s => String(s).replace(/[&<>"']/g,
  c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function statValue(g, stat) {
  if (stat === "MIN") return g.min;
  if (stat === "PRA") return g.PTS + g.REB + g.AST;
  if (stat === "PR") return g.PTS + g.REB;
  if (stat === "PA") return g.PTS + g.AST;
  if (stat === "RA") return g.REB + g.AST;
  return g[stat];
}

function niceTicks(vmax) {
  const step = [1, 2, 5, 10, 20, 25, 50]
    .find(s => vmax / s <= 5) || Math.ceil(vmax / 5);
  const out = [];
  for (let v = step; v <= vmax; v += step) out.push(v);
  return out;
}

function renderPropChart(games, line, proj) {
  // games chronological: [{date, opp, v, dim?}] — bars over/under vs the
  // line; a dim game (With & Without: outside the picked lineup) is faded
  const W = 920, H = 250, m = { t: 14, r: 52, b: 30, l: 8 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const n = games.length;
  const slot = iw / n;
  const bw = Math.min(24, Math.max(3, slot - 2));   // ≤24px + 2px gap
  const vmax = Math.max(...games.map(g => g.v), line, proj || 0, 1) * 1.12;
  const y = v => m.t + ih - (v / vmax) * ih;
  const parts = [];

  // right-margin label slots: line + projection first, ticks yield to them
  const lineY = y(line);
  const projY = proj != null ? y(proj) : null;
  const collide = (a, b) => Math.abs(a - b) < 13;
  // projection label sits at its tick unless that hits the line label —
  // then it anchors just past the line label on the projection's own side
  const projLblY = projY == null ? null
    : (!collide(projY + 4, lineY + 4) ? projY + 4
       : (projY >= lineY ? lineY + 17 : lineY - 9));

  for (const t of niceTicks(vmax)) {                 // recessive solid grid
    parts.push(`<line class="gline" x1="${m.l}" x2="${W - m.r}"
      y1="${y(t)}" y2="${y(t)}"></line>`);
    const ty = y(t) + 4;
    if (!collide(ty, lineY + 4) && (projLblY == null || !collide(ty, projLblY)))
      parts.push(`<text x="${W - m.r + 6}" y="${ty}">${t}</text>`);
  }

  games.forEach((g, i) => {
    const x = m.l + i * slot + (slot - bw) / 2;
    const top = y(g.v), base = m.t + ih;
    const hue = g.v > line ? "var(--over)" : "var(--under)";
    const r = Math.min(4, bw / 2, Math.max(0, base - top));
    const fade = g.dim ? ` opacity="0.25"` : "";
    const bar = g.v <= 0
      ? `<line x1="${x}" x2="${x + bw}" y1="${base}" y2="${base}"
           stroke="${hue}" stroke-width="2"${fade}></line>`
      : `<path d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top}
           H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r}
           V${base} Z" fill="${hue}"${fade}></path>`;
    parts.push(`<g class="barhit" data-i="${i}">
      <rect x="${m.l + i * slot}" y="${m.t}" width="${slot}" height="${ih}"
        fill="transparent"></rect>${bar}</g>`);
  });

  const lbl = Math.max(1, Math.ceil(n / 8));         // sparse x labels
  games.forEach((g, i) => {
    if (i % lbl) return;
    const x = m.l + i * slot + slot / 2;
    parts.push(`<text x="${x}" y="${H - 8}" text-anchor="middle">
      ${esc(g.date.slice(5))}</text>`);
  });

  parts.push(`<line class="propline" x1="${m.l}" x2="${W - m.r}"
      y1="${lineY}" y2="${lineY}"></line>
    <text class="proplbl" x="${W - m.r + 6}" y="${lineY + 4}">${line}</text>`);
  if (proj != null)
    parts.push(`<line class="projtick" x1="${m.l}" x2="${W - m.r}"
        y1="${projY}" y2="${projY}"></line>
      <text class="projlbl" x="${W - m.r + 6}" y="${projLblY}">
        ${proj.toFixed(1)}</text>`);

  return `<svg viewBox="0 0 ${W} ${H}" role="img"
    aria-label="game-by-game vs the line">${parts.join("")}</svg>`;
}

function hitCard(label, games, line) {
  if (!games.length) return "";
  const over = games.filter(g => g.v > line).length;
  const p = over / games.length;
  const dot = p > 0.5 ? "var(--over)" : p < 0.5 ? "var(--under)" : "var(--muted)";
  return `<div class="card"><div class="k">${label}</div>
    <div class="v"><span class="dot" style="background:${dot}"></span>
      ${(p * 100).toFixed(0)}%</div>
    <div class="r">${over}/${games.length} over</div></div>`;
}

/* ---------- player hub page ---------- */
// the find-a-player box (the hub and the players list): a name from the
// datalist, or a unique part of one, goes to his page
function wirePlayerSearch(idx, curId) {
  const q = $("#playerQ");
  if (!q) return;
  const label = p => `${p.player} (${p.team})`;
  const go = () => {
    const v = q.value.trim().toLowerCase();
    const hit = idx.find(p => label(p).toLowerCase() === v)
      || (v.length > 2 && idx.filter(p => p.player.toLowerCase().includes(v)).length === 1
          && idx.find(p => p.player.toLowerCase().includes(v)));
    if (hit && String(hit.player_id) !== String(curId))
      location.href = pHref(hit.player_id);
  };
  q.addEventListener("change", go);
  q.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
}

// /players/: the search bar at the top (owner, 26 Oct 2026); typing also
// narrows the team lists underneath, so the page works without the datalist
async function initPlayers() {
  const idx = await loadJSON("data/player_hub/index.json");
  const label = p => `${p.player} (${p.team})`;
  $("#playerList").innerHTML = idx.map(p =>
    `<option value="${esc(label(p))}"></option>`).join("");
  wirePlayerSearch(idx, null);
  const q = $("#playerQ");
  const sections = [...$$("main.static ul.plain")].map(ul => ({ ul, h: ul.previousElementSibling }));
  q.addEventListener("input", () => {
    const v = q.value.trim().toLowerCase().replace(/\s*\(.*$/, "");
    for (const { ul, h } of sections) {
      let shown = 0;
      for (const li of ul.children) {
        const on = !v || li.textContent.toLowerCase().includes(v);
        li.hidden = !on; shown += on;
      }
      ul.hidden = !shown;
      if (h && h.tagName === "H2") h.hidden = !shown;
    }
  });
}

async function initPlayer() {
  // a name page carries its player's id; the ID address forwards to the
  // name page where there is one, and to the players list with no id
  const pinned = document.body.dataset.pid;
  const qid = new URLSearchParams(location.search).get("id");
  if (!pinned && PLAYER_PAGES._full) {
    const to = qid ? PLAYER_PAGES[qid] : "/players/";
    if (to) { location.replace(to + location.hash); return; }
  }
  await renderFreshness();
  const idx = await loadJSON("data/player_hub/index.json");
  const label = p => `${p.player} (${p.team})`;
  $("#playerList").innerHTML = idx.map(p =>
    `<option value="${esc(label(p))}"></option>`).join("");
  const want = pinned || qid;
  const cur = idx.find(p => String(p.player_id) === want) || (pinned ? null : idx[0]);
  if (!cur) { const st = $("#pstatic"); if (st) st.hidden = false; return; }   // no hub: the page's own tables stand
  wirePlayerSearch(idx, cur.player_id);
  const pid = cur.player_id;
  const h = await loadData(`hub/${pid}`);
  const st = $("#pstatic");
  if (st) st.hidden = true;          // the page draws its own from here
  if (US) h.lines = h.lines_us || {};          // the US site: US books' lines

  $("#pname").textContent = h.player;
  document.title = `${h.player} Props Today: Projection vs the Line | Drop Coverage`;
  $("#psinglet").innerHTML = playerSinglet(h.team, h.number);
  const oppAb = h.opp ? teamMeta(h.opp)[0] : null;
  $("#pkicker").innerHTML = `${teamBadge(h.team)} ${esc(h.team || "")}${
    oppAb ? ` · v ${esc(oppAb)} tonight` : ""}${h.minutes
    ? ` · ${fmt(h.minutes.value, 0)} min predicted` : ""}`;

  const S = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TOV"];
  const P = h.projections || {};
  const L = favourLines(h.lines || {});
  // no answer sentence on the interactive page (owner, 16 Oct 2026); the
  // static player pages Google indexes keep theirs (brief section 9)
  // key teammates out tonight, and this player's own record without them
  const wwt = h.with_without_tonight || [];
  const wwEl = $("#wwTonight");
  if (wwEl) {
    wwEl.hidden = !wwt.length;
    const sg = v => `${v > 0 ? "+" : ""}${fmt(v)}`;
    wwEl.innerHTML = wwt.map(w => `<p class="sub"><b>${esc(w.star)} out tonight.</b>
      Without him, ${esc(h.player)} has averaged ${sg(w.PTS)} points,
      ${sg(w.REB)} rebounds and ${sg(w.AST)} assists per game
      (${w.n_without} games).</p>`).join("");
  }
  // tonight, in one line (owner, 6 Oct 2026): minutes, points, threes,
  // rebounds, assists; lines and edges live in the explorer below
  const strip = [["MIN", h.minutes ? h.minutes.value : null], ["PTS", P.PTS?.mean], ["3PM", P["3PM"]?.mean],
                 ["REB", P.REB?.mean], ["AST", P.AST?.mean]].filter(x => x[1] != null);
  $("#projCards").innerHTML = strip.length
    ? strip.map(([k, v]) => `<span class="pst"><span class="k">${k}</span><b>${fmt(v, k === "MIN" ? 0 : 1)}</b></span>`).join("")
    : `<span class="dim">No prediction tonight.</span>`;

  /* --- seasons (owner, 16 Oct 2026) ---
     "This season" and "Last season" are exact NBA seasons, never a mix;
     game type comes from the payload (regular, cup_final, play_in,
     playoffs). A game with no type (null) is outside every known season,
     so it never shows: no preseason anywhere. Older payloads without the
     fields fall back to the date. */
  const seasonOf = d => { const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return `${y}-${String(y + 1).slice(2)}`; };
  const curSeason = seasonOf(new Date());
  const prevSeason = seasonOf(new Date(new Date().getFullYear() - 1, new Date().getMonth(), 15));
  const sea = g => g.season || seasonOf(new Date(g.date + "T12:00:00"));
  const phaseOf = g => g.phase !== undefined ? g.phase
    : (/-0[4-7]-/.test(g.date) && g.date.slice(5) > "04-15" ? "playoffs" : "regular");
  const SAVG = ["MIN", "PTS", "REB", "AST", "3PM", "FGM", "FGA", "3PA", "FTA", "STL", "BLK", "TOV"];

  /* --- interactive prop chart --- */
  const CHART_STATS = [...S, ...COMBOS];
  const log = (h.game_log || []).filter(g => g.phase !== null);
  // season averages, regular season only: this season, then last
  const regular = season => log.filter(g => sea(g) === season && phaseOf(g) === "regular");
  const savgRows = [curSeason, prevSeason].map(sn => [sn, regular(sn)]);
  $("#savg thead").innerHTML = `<tr><th class="s">Season</th><th>G</th>${
    SAVG.map(k => `<th>${k}</th>`).join("")}</tr>`;
  $("#savg tbody").innerHTML = savgRows.map(([sn, gs]) => gs.length
    ? `<tr><td class="s">${sn}</td><td class="num dim">${gs.length}</td>${SAVG.map(k => {
        const v = gs.map(g => statValue(g, k)).filter(x => x != null);
        return `<td class="num">${v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "—"}</td>`;
      }).join("")}</tr>`
    : `<tr><td class="s">${sn}</td><td class="s dim" colspan="${SAVG.length + 1}">${
        sn === curSeason ? "No games yet this season." : "No games on record."}</td></tr>`).join("");
  $("#savgNote").textContent = "Regular-season games only, per game.";
  const lines = favourLines(h.lines || {});
  let stat = lines.PTS ? "PTS" : (Object.keys(lines)[0] || "PTS");
  const COMBO_OF = { PRA: ["PTS", "REB", "AST"], PR: ["PTS", "REB"],
                     PA: ["PTS", "AST"], RA: ["REB", "AST"] };
  // the public file (members' columns locked) carries no projections
  const projOf = s => h.projections?.[s]?.mean ?? (COMBO_OF[s]
    ? COMBO_OF[s].reduce((a, k) => a + (h.projections?.[k]?.mean || 0), 0)
    : undefined);
  const defLine = s => lines[s] ? lines[s].line
    : (projOf(s) != null ? Math.floor(projOf(s)) + 0.5 : 0.5);
  // one line per market, shared by the chart and the summary block
  const lineInputs = {};
  const lineFor = s => lineInputs[s] ?? defLine(s);

  const chipsEl = $("#statChips"), lineEl = $("#lineVal");
  chipsEl.innerHTML = CHART_STATS.map(s =>
    `<button class="chip" data-s="${s}">${s}</button>`).join("");

  const redraw = () => {
    $$(".chip", chipsEl).forEach(c =>
      c.classList.toggle("on", c.dataset.s === stat));
    const line = lineFor(stat);
    lineEl.value = line;
    $("#lineSrc").textContent = lines[stat]
      ? (line === lines[stat].line
         ? `book line${lines[stat].book ? ` (${lines[stat].book})` : ""}`
         : "custom line")
      : "no book line — custom";
    // the chart and hit rates follow the filters
    const games = filtered().map(g => ({ ...g, v: statValue(g, stat) }));
    const home = g => (g.venue || "").toUpperCase().startsWith("H");
    const all = log.map(g => ({ ...g, v: statValue(g, stat) }));
    $("#hitCards").innerHTML =
      hitCard("Filtered", games, line) +
      hitCard("Last 5", games.slice(-5), line) +
      hitCard("Last 10", games.slice(-10), line) +
      hitCard("Home", games.filter(home), line) +
      hitCard("Away", games.filter(g => !home(g)), line) +
      hitCard("This season", all.filter(g => sea(g) === curSeason), line) +
      hitCard("Last season", all.filter(g => sea(g) === prevSeason), line);
    $("#propChart").innerHTML = games.length
      ? renderPropChart(games, line, projOf(stat))
      : `<div class="empty">No games match these filters.</div>`;
    $("#chartNote").textContent =
      `${games.length} filtered game${games.length === 1 ? "" : "s"} · line ${line}`;

    const tip = $("#tip"), panel = $(".chartpanel");
    $$(".barhit", $("#propChart")).forEach(gEl => {
      const g = games[+gEl.dataset.i];
      gEl.addEventListener("pointermove", ev => {
        tip.replaceChildren();
        const b = document.createElement("b");
        b.textContent = `${g.v} ${stat}`;
        const d = document.createElement("div");
        d.textContent = `${g.date} · ${g.opp || "—"} · ${g.min} min`;
        tip.append(b, d);
        const r = panel.getBoundingClientRect();
        tip.style.left = Math.min(ev.clientX - r.x + 12, r.width - 170) + "px";
        tip.style.top = (ev.clientY - r.y - 44) + "px";
        tip.style.opacity = 1;
      });
      gEl.addEventListener("pointerleave", () => tip.style.opacity = 0);
    });
  };

  chipsEl.onclick = e => {
    const c = e.target.closest(".chip");
    if (!c) return;
    stat = c.dataset.s;
    redraw();
  };
  $("#lineDown").onclick = () => {
    lineInputs[stat] = Math.max(0.5, lineFor(stat) - 0.5); renderLog(); };
  $("#lineUp").onclick = () => { lineInputs[stat] = lineFor(stat) + 0.5; renderLog(); };
  lineEl.onchange = () => {
    const v = parseFloat(lineEl.value);
    if (!isNaN(v) && v > 0) { lineInputs[stat] = v; renderLog(); }
  };
  const SPLIT_LABEL = { season: "All games", l10: "Last 10", l5: "Last 5", home: "Home", away: "Away" };
  const rows = Object.entries(h.splits || {})   // the public cut has no splits
    .filter(([, v]) => v && v.games)
    .map(([k, v]) => `<tr><td class="s">${SPLIT_LABEL[k] || k}</td>
      <td class="num dim">${v.games}</td><td class="num">${fmt(v.min_pg, 0)}</td>
      ${S.map(s => `<td class="num">${v[s] ? fmt(v[s].pg) : "—"}</td>`).join("")}
    </tr>`);
  $("#splits tbody").innerHTML = rows.join("");

  /* --- game log explorer: filters -> summary, hit rates, log --- */
  const oppSel = $("#fOpp"), tierSel = $("#fTier"), resSel = $("#fResult");
  [...new Set(log.map(g => g.opp).filter(Boolean))].sort().forEach(o => {
    const el = document.createElement("option");
    el.value = el.textContent = o;
    oppSel.append(el);
  });
  // standings buckets exist only where both sides of a game are in the
  // spine; the dropdown lists whatever the data actually supports
  const tiers = [...new Set(log.map(g => g.opp_tier).filter(Boolean))];
  const tierOrder = t => t.startsWith("Top") ? 0 : t.startsWith("Mid") ? 1 : 2;
  tiers.sort((a, b) => tierOrder(a) - tierOrder(b)).forEach(t => {
    const el = document.createElement("option");
    el.value = t;
    el.textContent = "vs " + t;
    tierSel.append(el);
  });
  if (!tiers.length) tierSel.disabled = true;
  if (!log.some(g => g.result)) resSel.disabled = true;

  const filtered = () => {
    const loc = $("#fLoc").value, role = $("#fRole").value,
          rest = $("#fRest").value, opp = oppSel.value,
          res = resSel.value, tier = tierSel.value,
          lo = parseFloat($("#fMinLo").value),
          hi = parseFloat($("#fMinHi").value),
          lastSel = $("#fLast").value, type = $("#fType").value;
    const last = lastSel === "custom" ? parseInt($("#fN").value, 10) : parseInt(lastSel, 10);
    let out = log.filter(g => {
      const home = (g.venue || "").toUpperCase().startsWith("H");
      const ph = phaseOf(g);
      if (type === "regular" && ph !== "regular") return false;
      if (type === "playoffs" && ph !== "play_in" && ph !== "playoffs") return false;
      if (lastSel === "this" && sea(g) !== curSeason) return false;
      if (lastSel === "last" && sea(g) !== prevSeason) return false;
      if (loc === "H" && !home) return false;
      if (loc === "R" && home) return false;
      if (role === "start" && !g.starter) return false;
      if (role === "bench" && g.starter) return false;
      if (rest === "0" && String(g.rest) !== "0") return false;
      if (rest === "1+" && String(g.rest) === "0") return false;
      if (opp !== "all" && g.opp !== opp) return false;
      if (res !== "all" && g.result !== res) return false;
      if (tier !== "all" && g.opp_tier !== tier) return false;
      if (!isNaN(lo) && g.min < lo) return false;
      if (!isNaN(hi) && g.min > hi) return false;
      return true;
    });
    return last > 0 ? out.slice(-last) : out;
  };

  const median = a => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const renderLog = () => {
    const games = filtered();
    const mins = games.map(g => g.min);
    const totMin = mins.reduce((a, b) => a + b, 0);

    // the owner's summary block: stats across, measures down, on the
    // filtered games; the line row is editable (book line to start)
    // minutes first; shot volume last (owner, 16 Oct 2026): no line for those
    const NOLINE = new Set(["MIN", "FGM", "FGA", "3PA", "FTA"]);
    const SUM = ["MIN", ...S.slice(0, 4), ...COMBOS, ...S.slice(4), "FGM", "FGA", "3PA", "FTA"];
    const vals = s => games.map(g => statValue(g, s)).filter(x => x != null && !isNaN(x));
    const head = `<tr><th class="s"></th>${SUM.map(s =>
      `<th data-s="${s}" class="st">${s}</th>`).join("")}</tr>`;
    const row = (label, fn, cls = "") => `<tr class="${cls}"><td class="s">${label}</td>${
      SUM.map(s => `<td class="num" data-stat="${s}">${fn(s)}</td>`).join("")}</tr>`;
    const avg = s => { const v = vals(s); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const lineOf = s => lineFor(s);
    const rate = s => { const v = vals(s), l = lineOf(s);
      return (l == null || !v.length) ? null : v.filter(x => x > l).length / v.length; };
    $("#summary thead").innerHTML = head;
    $("#summary tbody").innerHTML =
      row("Average", s => avg(s) == null ? "—" : avg(s).toFixed(1)) +
      row("Median", s => vals(s).length ? median(vals(s)).toFixed(1) : "—") +
      row("Per 36", s => s !== "MIN" && totMin > 0 ? (vals(s).reduce((a, b) => a + b, 0) / totMin * 36).toFixed(1) : "—", "dimrow") +
      row("Prediction", s => s === "MIN" ? (h.minutes ? `<b class="pv">${fmt(h.minutes.value, 0)}</b>` : "—")
        : P[s] ? `<b class="pv">${fmt(P[s].mean)}</b>` : "—", "sep") +
      row("Line", s => NOLINE.has(s) ? "—" : `<input class="lineIn" data-s="${s}" type="number" step="0.5" value="${
        lineOf(s) ?? ""}" title="${L[s] ? `book line${L[s].book ? ` (${esc(bookName(L[s].book))})` : ""}` : "no book line: type one"}">`, "linerow") +
      row("Over", s => { const v = vals(s), l = lineOf(s);
        return NOLINE.has(s) || l == null ? "—" : `${v.filter(x => x > l).length}/${v.length}`; }, "dimrow") +
      row("Hit rate", s => { const r = NOLINE.has(s) ? null : rate(s);
        return r == null ? "—" : `<span class="${r >= 0.6 ? "hi" : r <= 0.4 ? "lo" : ""}">${(r * 100).toFixed(0)}%</span>`; });
    $("#sumNote").textContent = `${games.length} of ${log.length} games · min avg ${
      games.length ? (totMin / games.length).toFixed(1) : "—"}. Hit rate = share of these games over the line; edit a line to test your own.`;
    $$(".lineIn", $("#summary")).forEach(inp => {
      inp.onchange = () => {
        const v = parseFloat(inp.value);
        lineInputs[inp.dataset.s] = isNaN(v) ? null : v;
        renderLog();
      };
    });
    const active = ["#fLoc", "#fRole", "#fRest", "#fResult", "#fTier", "#fOpp", "#fType"]
      .filter(sel => $(sel).value !== "all").length
      + (($("#fMinLo").value || $("#fMinHi").value) ? 1 : 0);
    $("#fCount").textContent = active ? `· ${active} on` : "";

    $("#gamelog tbody").innerHTML = games.slice().reverse().map(g => `<tr>
      <td class="s">${g.game
        ? `<a href="/boxscore.html?g=${encodeURIComponent(g.game)}"
             target="_blank" rel="noopener" title="open box score">${g.date} ↗</a>`
        : `<span class="dim">${g.date}</span>`}</td>
      <td class="s">${teamBadge(g.opp)}${g.opp_tier
        ? ` <span class="dim" title="opponent standing">(${esc(g.opp_tier)})</span>` : ""}</td>
      <td class="s dim">${(g.venue || "").toUpperCase().startsWith("H") ? "H" : "A"}</td>
      <td class="s ${g.result === "W" ? "pos" : g.result === "L" ? "neg" : "dim"}">${g.result || "—"}</td>
      <td class="s">${g.starter
        ? '<span class="badge src">start</span>' : '<span class="dim">bench</span>'}</td>
      <td class="num">${fmt(g.min, 0)}</td>
      ${["PTS", "REB", "AST", "3PM", "FGM", "FGA", "3PA", "FTA", "STL", "BLK", "TOV"]
        .map(s => `<td class="num${["FGM", "FGA", "3PA", "FTA"].includes(s) ? " dim" : ""}">${fmt(g[s], 0)}</td>`).join("")}
      <td class="num dim">${fmt(statValue(g, "PRA"), 0)}</td>
    </tr>`).join("")
      || `<tr><td colspan="18" class="empty">${$("#fLast").value === "this" && !log.some(g => sea(g) === curSeason)
        ? `No ${curSeason} games yet: the season starts 20 October. Pick “Last season” to see ${prevSeason}.`
        : "No games match these filters."}</td></tr>`;
    redraw();
  };

  if (matchMedia("(max-width: 900px)").matches) $("#filterBox").open = false;
  ["#fLast", "#fLoc", "#fRole", "#fRest", "#fOpp", "#fResult",
   "#fTier", "#fType"].forEach(sel => $(sel).onchange = () => {
    $("#fNWrap").hidden = $("#fLast").value !== "custom";
    renderLog();
  });
  ["#fMinLo", "#fMinHi", "#fN"].forEach(sel => $(sel).oninput = renderLog);
  $("#fReset").onclick = () => {
    $("#fLast").value = "20"; $("#fType").value = "all"; $("#fN").value = "";
    $("#fNWrap").hidden = true; $("#fLoc").value = "all";
    $("#fRole").value = "all"; $("#fRest").value = "all";
    oppSel.value = "all"; resSel.value = "all"; tierSel.value = "all";
    $("#fMinLo").value = ""; $("#fMinHi").value = "";
    for (const k of Object.keys(lineInputs)) delete lineInputs[k];
    renderLog();
  };
  renderLog();
}

/* ---------- with & without page (in/out lineup explorer) ---------- */
async function initWow() {
  await renderFreshness();
  const S = ["PTS", "REB", "AST", "3PM", "FGM", "FGA", "3PA", "STL", "BLK", "TOV"];
  const index = await loadJSON("data/teams/index.json");
  const teamSel = $("#wTeam"), playerSel = $("#wPlayer"), seasonSel = $("#wSeason");
  teamSel.innerHTML = index.map(t =>
    `<option value="${esc(t.slug)}">${esc(t.team)}</option>`).join("");
  const today = new Date().toISOString().slice(0, 10);
  const cur = seasonOfIso(today);

  let team = null;                 // loaded team payload
  let focal = null;                // focal player id (string)
  // teammates who must have played (with) and who must have sat (without):
  // two multi-select pickers (owner, 6 Oct 2026), names -> ids
  let withP = new Set(), withoutP = new Set();
  let idOf = {}, nameOf = {};
  let season = null;               // a season label, "last2" or "all" (owner, 16 Oct 2026)
  let lastN = 0;                   // 0 = every game in the window; else his last N (owner, 28 Oct 2026)
  const state = { get size() { return withP.size + withoutP.size; },
                  clear() { withP.clear(); withoutP.clear(); } };

  // averages skip missing values (shot columns are blank on a few old rows)
  const avg = (games, pick) => {
    const v = games.map(pick).filter(x => x != null && !Number.isNaN(x));
    return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null;
  };
  const focalLine = g => g.lines[focal];
  const played = (g, id) => g.lines[id] !== undefined;
  const gSeason = g => g.season || seasonOfIso(g.date);
  const seasonsWithGames = () => [...new Set(team.games.map(gSeason))].sort().reverse();
  const inSeason = g => season === "all" ? true
    : season === "last2" ? seasonsWithGames().slice(0, 2).includes(gSeason(g))
    : gSeason(g) === season;
  const seasonGames = () => team.games.filter(inSeason);
  // the comparison window: the season's games, or his last N of them
  // (games he played, newest first); the teammate list and the roster
  // stay on the whole season
  const windowGames = () => {
    const g = seasonGames();
    if (!lastN) return g;
    const mine = g.filter(focalLine).slice().sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0)).slice(0, lastN);
    const keep = new Set(mine);
    return g.filter(x => keep.has(x));
  };

  const matching = () => windowGames().filter(g => {
    if (!focalLine(g)) return false;           // focal must have played
    for (const n of withP) if (!played(g, idOf[n])) return false;
    for (const n of withoutP) if (played(g, idOf[n])) return false;
    return true;
  });

  const CELLS = [["min", g => focalLine(g).min]].concat(S.map(s => [s, g => focalLine(g)[s]]));
  const NCOL = CELLS.length + 2;
  const rowFor = (label, games, cls = "") => {
    if (!games.length)
      return `<tr class="${cls}"><td class="s">${label}</td><td class="num dim">0</td>
        <td colspan="${CELLS.length}" class="empty">no games</td></tr>`;
    return `<tr class="${cls}"><td class="s"><b>${label}</b></td>
      <td class="num dim">${games.length}</td>
      ${CELLS.map(([, pick]) => { const v = avg(games, pick);
        return `<td class="num">${v == null ? "—" : v.toFixed(1)}</td>`; }).join("")}
    </tr>`;
  };
  // matching lineup minus the rest of his games (owner: "without X, he
  // attempts 70% more triples" — against the games X played)
  const diffRow = (sel, rest) => {
    if (!sel.length || !rest.length) return "";
    return `<tr><td class="s">Difference</td><td class="num dim">—</td>
      ${CELLS.map(([, pick]) => {
        const a = avg(sel, pick), b = avg(rest, pick);
        if (a == null || b == null) return `<td class="num dim">—</td>`;
        const d = a - b;
        return `<td class="num ${d > 0 ? "pos" : d < 0 ? "neg" : "dim"}">${
          (d > 0 ? "+" : "") + d.toFixed(1)}</td>`;
      }).join("")}</tr>`;
  };
  const lineupLabel = () => [withP.size ? `with ${[...withP].join(", ")}` : "",
    withoutP.size ? `without ${[...withoutP].join(", ")}` : ""].filter(Boolean).join(", ");
  const changeLine = (sel, rest) => {
    if (!sel.length || !rest.length) return "";
    const KEYS = [["PTS", "points"], ["FGA", "shots"], ["3PA", "3PA"], ["FTA", "free throws"], ["AST", "assists"],
                  ["REB", "rebounds"], ["min", "minutes"]];
    const moves = [];
    for (const [k, word] of KEYS) {
      const pick = k === "min" ? (g => focalLine(g).min) : (g => focalLine(g)[k]);
      const a = avg(sel, pick), b = avg(rest, pick);
      if (a == null || b == null || b < 0.5) continue;
      const pct = (a - b) / b;
      if (Math.abs(pct) >= 0.10) moves.push({ word, a, b, pct });
    }
    moves.sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct));
    const who = playerSel.selectedOptions[0]?.textContent || "He";
    const lab = lineupLabel();
    const head = `${lab.charAt(0).toUpperCase() + lab.slice(1)} (${sel.length} games against ${rest.length}), ${esc(who)}`;
    if (!moves.length) return `${head} is within 10% of his other games on every main stat.`;
    return `${head}: ` + moves.slice(0, 4).map(m =>
      `${m.word} <b class="${m.pct > 0 ? "pos" : "neg"}">${m.pct > 0 ? "+" : "−"}${Math.abs(m.pct * 100).toFixed(0)}%</b> (${m.a.toFixed(1)} v ${m.b.toFixed(1)})`).join(", ") + ".";
  };

  const renderMates = () => {
    const games = seasonGames();
    const ids = new Set(games.flatMap(g => Object.keys(g.lines)));
    const mates = team.players.filter(p => String(p.id) !== focal && ids.has(String(p.id))).map(p => p.name);
    $("#wPick").innerHTML = `<div id="wWith"></div><div id="wWithout"></div>`;
    withP = multiSelect($("#wWith"), "With (played)", mates, render);
    withoutP = multiSelect($("#wWithout"), "Without (sat)", mates, render);
  };

  const render = () => {
    const all = windowGames().filter(focalLine);
    const sel = matching();
    const selSet = new Set(sel);
    const rest = all.filter(g => !selSet.has(g));
    const anyFilter = state.size > 0;
    $("#wCompare tbody").innerHTML =
      rowFor("All games", all)
      + (anyFilter ? rowFor("Matching lineup", sel) + rowFor("Other games", rest, "thin") + diffRow(sel, rest) : "");
    const fallback = season === cur || season === "all" || season === "last2" ? ""
      : !team.games.some(g => gSeason(g) === cur) && seasonSel.dataset.auto === "1"
        ? ` No ${cur} games yet: showing ${season} until opening night.` : "";
    $("#wChange").innerHTML = anyFilter ? changeLine(sel, rest) : "";
    const win = lastN ? ` (his last ${Math.min(lastN, all.length)} games)` : "";
    $("#wNote").textContent = (anyFilter
      ? `${sel.length} of ${all.length} games match${win}.`
        + (sel.length < 5 ? " Small sample: read with caution." : "")
      : `Pick teammates above to split the games${win}.`) + fallback;
    $("#wLog tbody").innerHTML = sel.slice().reverse().map(g => {
      const l = focalLine(g);
      return `<tr>
        <td class="s">${g.game
          ? `<a href="/boxscore.html?g=${encodeURIComponent(g.game)}"
               target="_blank" rel="noopener">${g.date} ↗</a>`
          : `<span class="dim">${g.date}</span>`}</td>
        <td class="s">${teamBadge(g.opp)}</td>
        <td class="s dim">${(g.venue || "").toUpperCase().startsWith("H") ? "H" : "A"}</td>
        <td class="num">${fmt(l.min, 0)}</td>
        ${S.map(s => `<td class="num">${l[s] == null ? "—" : fmt(l[s], 0)}</td>`).join("")}
      </tr>`;
    }).join("") || `<tr><td colspan="${NCOL + 2}" class="empty">No games match.</td></tr>`;
    const trs = $$("#wLog tbody tr");
    if (trs.length > 25 && !logAll) {
      trs.slice(25).forEach(t => t.hidden = true);
      $("#wLog tbody").insertAdjacentHTML("beforeend", `<tr><td colspan="${NCOL + 2}" class="s"><a href="#" id="wLogAll">Show all ${trs.length} games →</a></td></tr>`);
      $("#wLogAll").onclick = e => { e.preventDefault(); logAll = true; render(); };
    }
    renderChart(all, sel);
  };
  let logAll = false;

  /* --- game by game (owner, 21 Oct 2026: the player page's graph) ---
     every game of his in the season, matching-lineup games in full and
     the rest faded; one line per stat, defaulting to just under his
     average in the season's games (no book line on this page) */
  const WSTATS = ["PTS", "REB", "AST", "3PM", "PRA", "PR", "PA", "RA", "MIN"];
  let wStat = "PTS";
  const wLines = {};
  const statOf = (g, k) => statValue({ ...focalLine(g), min: focalLine(g).min }, k);
  const defaultLine = (games, k) => {
    const v = games.map(g => statOf(g, k)).filter(x => x != null && !Number.isNaN(x));
    return v.length ? Math.max(0.5, Math.floor(v.reduce((a, x) => a + x, 0) / v.length) + 0.5) : 0.5;
  };
  const renderChart = (all, sel) => {
    const anyFilter = state.size > 0;
    const selSet = new Set(sel);
    const line = wLines[wStat] ?? defaultLine(all, wStat);
    $$(".chip", $("#wStatChips")).forEach(c => c.classList.toggle("on", c.dataset.s === wStat));
    $("#wLineVal").value = line;
    $("#wLineSrc").textContent = wLines[wStat] != null ? "custom line" : "line: just under his average";
    const games = all.map(g => ({ date: g.date, opp: g.opp, min: focalLine(g).min,
                                  v: statOf(g, wStat), dim: anyFilter && !selSet.has(g) }))
      .filter(g => g.v != null && !Number.isNaN(g.v));
    const matched = games.filter(g => !g.dim), other = games.filter(g => g.dim);
    const lab = lineupLabel();
    $("#wHitCards").innerHTML = anyFilter
      ? hitCard(lab.charAt(0).toUpperCase() + lab.slice(1), matched, line)
        + hitCard("Other games", other, line) + hitCard("All games", games, line)
      : hitCard("All games", games, line) + hitCard("Last 10", games.slice(-10), line)
        + hitCard("Last 5", games.slice(-5), line);
    $("#wChart").innerHTML = games.length
      ? renderPropChart(games, line, null)
      : `<div class="empty">No games this season yet.</div>`;
    $("#wFadeKey").hidden = !anyFilter;
    $("#wChartNote").textContent = `${anyFilter ? `${matched.length} of ${games.length}` : games.length} games · line ${line}`;
    const tip = $("#wTip"), panel = $("#wPanel");
    $$(".barhit", $("#wChart")).forEach(gEl => {
      const g = games[+gEl.dataset.i];
      gEl.addEventListener("pointermove", ev => {
        tip.replaceChildren();
        const b = document.createElement("b");
        b.textContent = `${g.v} ${wStat}`;
        const d = document.createElement("div");
        d.textContent = `${g.date} · ${g.opp || "—"} · ${fmt(g.min, 0)} min`
          + (anyFilter ? (g.dim ? " · other game" : " · matching lineup") : "");
        tip.append(b, d);
        const r = panel.getBoundingClientRect();
        tip.style.left = Math.min(ev.clientX - r.x + 12, r.width - 190) + "px";
        tip.style.top = (ev.clientY - r.y - 44) + "px";
        tip.style.opacity = 1;
      });
      gEl.addEventListener("pointerleave", () => tip.style.opacity = 0);
    });
  };
  $("#wStatChips").innerHTML = WSTATS.map(k => `<button class="chip" data-s="${k}">${k}</button>`).join("");
  $("#wStatChips").onclick = e => {
    const c = e.target.closest(".chip");
    if (!c) return;
    wStat = c.dataset.s;
    render();
  };
  const curLine = () => wLines[wStat] ?? defaultLine(seasonGames().filter(focalLine), wStat);
  $("#wLineDown").onclick = () => { wLines[wStat] = Math.max(0.5, curLine() - 0.5); render(); };
  $("#wLineUp").onclick = () => { wLines[wStat] = curLine() + 0.5; render(); };
  $("#wLineVal").onchange = () => {
    const v = parseFloat($("#wLineVal").value);
    if (!isNaN(v) && v > 0) { wLines[wStat] = v; render(); }
  };

  // the player list follows the season: who played for the team in it,
  // most minutes first (owner, 16 Oct 2026)
  const fillPlayers = () => {
    const games = seasonGames();
    const mins = {};
    for (const g of games) for (const [id, l] of Object.entries(g.lines)) (mins[id] ||= []).push(l.min);
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const roster = team.players.filter(p => mins[String(p.id)])
      .sort((a, b) => med(mins[String(b.id)]) - med(mins[String(a.id)]));
    const keep = roster.some(p => String(p.id) === focal) ? focal : (roster[0] ? String(roster[0].id) : null);
    playerSel.innerHTML = roster.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
    if (keep) playerSel.value = keep;
    focal = playerSel.value || null;
  };
  const fillSeasons = () => {
    const have = seasonsWithGames();
    const opts = [...new Set([cur, ...have])].sort().reverse();
    if (season == null || (!opts.includes(season) && season !== "last2" && season !== "all")) {
      season = have.includes(cur) ? cur : (have[0] || cur);
      seasonSel.dataset.auto = "1";
    }
    seasonSel.innerHTML = opts.map(s => `<option value="${s}">${s}</option>`).join("")
      + `<option value="last2">Last 2 seasons</option><option value="all">All seasons</option>`;
    seasonSel.value = season;
  };

  const loadTeam = async slug => {
    team = await loadJSON(`data/teams/${slug}.json`);
    idOf = {}; nameOf = {};
    team.players.forEach(p => { idOf[p.name] = String(p.id); nameOf[String(p.id)] = p.name; });
    state.clear();
    fillSeasons();
    fillPlayers();
    renderMates();
    render();
  };

  teamSel.onchange = () => loadTeam(teamSel.value);
  seasonSel.onchange = () => { season = seasonSel.value; seasonSel.dataset.auto = "0"; fillPlayers(); renderMates(); render(); };
  $("#wLast").onchange = e => { lastN = +e.target.value || 0; render(); };
  playerSel.onchange = () => { focal = playerSel.value; Object.keys(wLines).forEach(k => delete wLines[k]); renderMates(); render(); };
  $("#wReset").onclick = () => { renderMates(); render(); };
  await loadTeam(teamSel.value);
}

/* ---------- matchups page ---------- */
async function initMatchups() {
  await renderFreshness();
  const data = await loadData("matchups");
  const S = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TOV"];
  const ORDER = ["PG", "SG", "SF", "PF", "C", "G", "F",
                 "Ball handler", "Shooter", "Wing", "Rim big", "Stretch big"];
  const allRows = Object.values(data.windows).flat();
  const byOrder = (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b);
  const positions = [...new Set(allRows.filter(r => (r.kind || "position") === "position").map(r => r.pos))].sort(byOrder);
  const roles = [...new Set(allRows.filter(r => r.kind === "role").map(r => r.pos))].sort(byOrder);
  let pos = positions[0];
  const winSel = $("#winSel");
  [...winSel.options].forEach(o => { if (!data.windows[o.value]) o.remove(); });
  if (!winSel.options.length) throw new Error("no matchup windows");
  if (data.coverage != null) {
    const note = document.createElement("p");
    note.className = "sub";
    const own = data.basis === "own-rate per possession";
    note.innerHTML = own
      ? `Built from our own box scores. Each player-game is measured against what
      that player normally produces per possession in the same window (his other
      games this season for the season and month views, last season's for last
      season, both faded together for the model view), so the number is how much
      more (+) or less (−) a defence allowed than those players' own rates, pooled
      over minutes. Early in the season the number is pulled toward even until the
      sample builds, and the pull is set so the number shown is what lands: over
      last season, a shown +5% landed about +5% for points, a little under for
      rebounds and assists, and about two-thirds of it for threes. The raw figure
      sits in each cell's tooltip and under "raw %", so a small number beside a
      bigger one elsewhere is method, not doubt. Pace
      is the games' possessions per 48 and is shown on its own rather than mixed in. Positions are each player's usual
      spot, covering <b>${(data.coverage * 100).toFixed(0)}%</b> of minutes;
      roles come from each player's own profile${roles.length ? " (" + roles.map(r =>
      `${esc(r)}: ${esc((data.roles || {})[r] || "")}`).join("; ") + ")" : ""}.
      "Per game" is what the group scored against that defence per game.`
      : `Built from our own box scores. Positions are each
      player's usual spot (PG/SG/SF/PF/C), covering <b>${(data.coverage * 100).toFixed(0)}%</b>
      of minutes played; players without one are left out rather than guessed.
      "% v league" is per minute against the league rate for the position;
      "per game" is what the position scored against that defence per game.`;
    $("#posChips").parentElement.after(note);
  }
  $("#posChips").innerHTML = positions.map(p =>
    `<button class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join("")
    + (roles.length ? `<span class="chipgap" aria-hidden="true"></span>` + roles.map(p =>
    `<button class="chip role" data-p="${esc(p)}">${esc(p)}</button>`).join("") : "");

  let rows = [], sortK = "PTS", sortDir = -1;
  // two readings of the same cell: % against the league rate for the
  // position (per minute), or what the position scored per game
  let mode = "pct";
  const modeSel = $("#modeSel");
  if (modeSel) modeSel.onchange = () => { mode = modeSel.value; render(); };
  const pct = v => (v > 0 ? "+" : "") + (v * 100).toFixed(0) + "%";
  const cell = (v, raw, mins) => v == null ? `<td class="num dim">—</td>`
    : `<td class="num ${v > 0.03 ? "pos" : v < -0.03 ? "neg" : ""}" title="${raw == null ? "" :
         `raw ${pct(raw)} from ${mins ?? "—"} min; pulled toward even until the sample builds`}">
         ${pct(v)}</td>`;
  const rcell = v => v == null ? `<td class="num dim">—</td>`
    : `<td class="num dim ${v > 0.03 ? "pos" : v < -0.03 ? "neg" : ""}">${pct(v)}</td>`;
  const gcell = (v, lg) => v == null ? `<td class="num dim">—</td>`
    : `<td class="num ${lg != null && v > lg * 1.03 ? "pos" : lg != null && v < lg * 0.97 ? "neg" : ""}">${fmt(v)}</td>`;
  const render = () => {
    $$(".chip", $("#posChips")).forEach(c =>
      c.classList.toggle("on", c.dataset.p === pos));
    const win = $("#winSel").value;
    const key = s => mode === "pct" ? s : mode === "raw" ? "raw_" + s : "g_" + s;
    const lg = (data.league || {})[win]?.[pos] || {};
    rows = data.windows[win]
      .filter(r => r.pos === pos)
      .sort((a, b) => {
        const kk = sortK === "minutes" || sortK === "team" || sortK === "pace" ? sortK : key(sortK);
        const x = a[kk], y = b[kk];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * -sortDir;
      });
    const lgPace = (data.league || {})[win]?.pace;
    const pcell = v => v == null ? `<td class="num dim">—</td>`
      : `<td class="num ${lgPace != null && v > lgPace * 1.02 ? "pos" : lgPace != null && v < lgPace * 0.98 ? "neg" : ""}">${v.toFixed(1)}</td>`;
    const lgRow = mode !== "game" ? "" : `<tr class="thin"><td class="s dim">League average, ${esc(pos)}</td><td class="num dim"></td><td class="num dim">${lgPace == null ? "" : lgPace.toFixed(1)}</td>${
      S.map(s => `<td class="num dim">${lg[s] == null ? "—" : fmt(lg[s])}</td>`).join("")}</tr>`;
    $("#mx tbody").innerHTML = (rows.map(r => `<tr>
      <td class="s">${teamBadge(r.team, {withName: true})}</td>
      <td class="num dim">${mode === "game" ? (r.games ?? "—") : (r.minutes ?? "—")}</td>
      ${pcell(r.pace)}
      ${S.map(s => mode === "pct" ? cell(r[s], r["raw_" + s], r.minutes) : mode === "raw" ? rcell(r["raw_" + s]) : gcell(r["g_" + s], lg[s])).join("")}
    </tr>`).join("") + lgRow) ||
      `<tr><td colspan="10" class="empty">No teams meet the sample floor
       in this window.</td></tr>`;
    const th = $("#mx th[data-k=minutes]");
    if (th) th.textContent = mode === "game" ? "G" : "Min";
  };
  $$("th[data-k]", $("#mx")).forEach(th => th.onclick = () => {
    const k = th.dataset.k;
    sortDir = (sortK === k) ? -sortDir : -1;
    sortK = k;
    render();
  });
  $("#posChips").onclick = e => {
    const c = e.target.closest(".chip");
    if (c) { pos = c.dataset.p; render(); }
  };
  $("#winSel").onchange = render;
  render();
}

/* ---------- box score page ---------- */
async function initBoxscore() {
  const key = new URLSearchParams(location.search).get("g");
  if (!key) { $("#bsSub").textContent = "No game specified."; return; }
  const d = await loadJSON(`data/box_scores/${encodeURIComponent(key)}.json`);
  const S = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TOV"];
  $("#bsTitle").textContent = d.matchup;
  $("#bsSub").textContent = d.date;
  document.title = `${d.matchup} ${d.date} | Drop Coverage`;
  $("#bsTables").innerHTML = Object.entries(d.teams).map(([team, t]) => `
    <div class="section"><h2>${teamBadge(team)} ${esc(team)}</h2></div>
    <div class="tablewrap"><table>
      <thead><tr><th class="s">Player</th><th>Min</th>
        ${S.map(s => `<th>${s}</th>`).join("")}</tr></thead>
      <tbody>
        ${t.players.map(p => `<tr>
          <td class="s"><a href="${pHref(p.player_id)}">
            ${esc(p.player)}</a>${p.starter
              ? ' <span class="badge src">start</span>' : ""}</td>
          <td class="num">${fmt(p.min, 0)}</td>
          ${S.map(s => `<td class="num">${fmt(p[s], 0)}</td>`).join("")}
        </tr>`).join("")}
        <tr><td class="s"><b>Total</b></td>
          <td class="num dim">${fmt(t.totals.min, 0)}</td>
          ${S.map(s => `<td class="num"><b>${fmt(t.totals[s], 0)}</b></td>`).join("")}
        </tr>
      </tbody>
    </table></div>`).join("")
    + (Object.keys(d.teams).length < 2
       ? `<p class="sub">Opponent side unavailable in the fixture demo —
          the full run emits both teams.</p>` : "");
}

/* ---------- track record page ---------- */
async function initRecord() {
  await renderFreshness();
  const d = await loadJSON("data/track_record.json");
  const cal = d.calibration || {};
  const mk = cal.markets || [];
  const W = (m, k) => (m.windows || {})[k] || { n: 0 };
  const pts = mk.find(m => m.stat === "PTS");
  const all = mk.reduce((a, m) => {
    const s = W(m, "season"); if (!s.n) return a;
    a.n += s.n; a.in += s.coverage * s.n; return a; }, { n: 0, in: 0 });
  $("#rlead").innerHTML = pts && W(pts, "season").n
    ? `Across <b>${W(pts, "season").n.toLocaleString("en-AU")}</b> player games this season, our points predictions `
      + `missed by <span class="n">${fmt(W(pts, "season").mae)}</span> on average, and `
      + `<span class="n">${pct(all.in / all.n)}</span> of results landed inside our 80% range.`
    : `The track record starts from opening night, 20 October (21 October AEDT). From then, every prediction is graded here the morning after, in the open.`;
  const cell = w => w.n ? `${fmt(w.mae, 2)}<div class="sm dim">${w.n.toLocaleString("en-AU")} games</div>` : `<span class="dim">—</span>`;
  $("#acc tbody").innerHTML = mk.length ? mk.map(m => `<tr>
      <td class="s">${esc(m.label)}</td><td class="num">${cell(W(m, "7d"))}</td>
      <td class="num">${cell(W(m, "30d"))}</td><td class="num">${cell(W(m, "season"))}</td>
      <td class="num opt">${W(m, "season").n ? (W(m, "season").bias > 0 ? "+" : "") + fmt(W(m, "season").bias, 2) : "—"}</td></tr>`).join("")
    : `<tr><td colspan="5" class="empty">Fills in from opening night.</td></tr>`;
  $("#cov tbody").innerHTML = mk.length ? mk.map(m => { const s = W(m, "season");
      return `<tr><td class="s">${esc(m.label)}</td>
      <td class="num"><b>${pct(s.coverage)}</b></td>
      <td class="num">${pct(s.below)}</td><td class="num">${pct(s.above)}</td>
      <td class="num opt">${s.n ? s.n.toLocaleString("en-AU") : "—"}</td></tr>`; }).join("")
    : `<tr><td colspan="5" class="empty">Fills in from opening night.</td></tr>`;
  const pl = d.plays || {};
  const graded = pl.n_graded ?? 0;
  const since = pl.rule_since
    ? ` since ${new Date(pl.rule_since + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`
    : "";
  // the rule in force (chance and winners, 28 Oct 2026) is the headline;
  // the props graded under the earlier rules stay on the record beneath
  const ea = pl.earlier;
  const earlier = ea && (ea.n_graded ?? 0)
    ? `<p class="sub">Under the earlier rules (20 to 27 October, a 5-point then a 15-point edge over the bookmaker):
       <b>${ea.won ?? 0}–${ea.lost ?? 0}</b>, ${ea.push ?? 0} push, ${ea.void ?? 0} void, hit rate <b>${pct(ea.hit)}</b>,
       average CLV ${pct(ea.avg_clv)} over ${ea.n_clv ?? 0} closed, ${fmt(ea.units, 1)} units flat (${pct(ea.roi)}).
       Kept on the record.</p>`
    : "";
  $("#rplays").innerHTML = `
    <div class="card"><div class="k">Covered–not</div><div class="v">${pl.won ?? 0}–${pl.lost ?? 0}</div><div class="r">${pl.push ?? 0} push · ${pl.void ?? 0} void · ${pl.open ?? 0} open${since}</div></div>
    <div class="card"><div class="k">Hit rate</div><div class="v">${pct(pl.hit)}</div><div class="r">${graded} graded under the rule in force</div></div>
    <div class="card"><div class="k">Avg CLV</div><div class="v">${pct(pl.avg_clv)}</div><div class="r">${pl.n_clv ?? 0} closed · beat the close ${pct(pl.beat_close)}</div></div>
    <div class="card"><div class="k">Return on stake</div><div class="v">${pl.roi_public ? pct(pl.roi) : "—"}</div><div class="r">${pl.roi_public ? `${fmt(pl.units, 1)} units, flat 1 unit` : `published from ${pl.public_roi_from ?? 100} graded props`}</div></div>`;
  $("#rplays").insertAdjacentHTML("afterend", earlier);
  const t = d.tips;
  const tOpen = t?.averages_public, tLater = dropsLater(t);
  $("#rtip").innerHTML = `
    <div class="card"><div class="k">Avg CLV</div><div class="v">${tOpen ? pct(t.avg_clv) : "—"}</div><div class="r">${tOpen ? `${t.n_clv ?? 0} graded at the close` : tLater}</div></div>
    <div class="card"><div class="k">Beat the close</div><div class="v">${tOpen ? pct(t.beat_close) : "—"}</div>${tOpen ? "" : `<div class="r">${tLater}</div>`}</div>
    <div class="card"><div class="k">Covered–not</div><div class="v">${t ? `${t.wins}–${t.losses}` : "0–0"}</div><div class="r"><a href="/tip.html">Every Drop →</a></div></div>
    <div class="card"><div class="k">Units</div><div class="v ${unitsCls(t?.units)}">${unitsTxt(t?.units ?? 0)}</div><div class="r">1 unit on every Drop</div></div>`;
  const e = d.edges || {};
  $("#redges").innerHTML = `
    <div class="card"><div class="k">Avg CLV</div><div class="v">${pct(e.avg_clv)}</div><div class="r">${e.n_clv ?? 0} graded at the close</div></div>
    <div class="card"><div class="k">Beat the close</div><div class="v">${pct(e.beat_close)}</div></div>
    <div class="card"><div class="k">Edges flagged</div><div class="v">${(e.n ?? 0).toLocaleString("en-AU")}</div></div>`;
}

/* ---------- The Drop (internally: the tip) ---------- */
// the record's averages show once 30 Drops are graded (owner, 21 Oct 2026;
// tip.AVERAGES_FROM): one result is mostly luck
function dropsLater(s) {
  const from = s?.averages_from ?? 30,
        n = s?.n_graded ?? ((s?.wins ?? 0) + (s?.losses ?? 0) + (s?.pushes ?? 0));
  return `from ${from} graded Drops (${n} so far)`;
}
function auDay(isoDate) {
  const d = new Date(isoDate + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "short",
    day: "numeric", month: "short" }).format(d).replace(",", "");
}
const sideWord = s => s === "over" ? "Over" : "Under";
const sideGlyph = s => s === "over" ? "▲O" : "▼U";

function tipBet(t) {
  return `${t.market_label} ${sideWord(t.side)} <b>${fmt(t.line)}</b> @ `
    + `<b>${odds(t.price)}</b>, ${t.book_label}`;
}

async function initTip() {
  await renderFreshness();
  const d = await loadJSON("data/tips.json");
  const t = d.today;
  const day = auDay(d.au_game_date);
  if (t) {
    const game = [t.team, t.opp].filter(Boolean).join(" v ");
    $("#tlead").innerHTML = `Today's Drop, for ${day}, is <b>${t.player}</b> `
      + `${sideWord(t.side).toLowerCase()} ${fmt(t.line)} ${t.market_label.toLowerCase()} `
      + `at ${odds(t.price)} with ${t.book_label}; our projection is `
      + `<span class="n ${sideCls(t.side)}">${fmt(t.model_proj)}</span>.`;
    const closed = t.closing_price != null
      ? `Closed ${fmt(t.closing_line)} @ ${odds(t.closing_price)} · CLV ${pct(t.clv)}` : "";
    const res = t.result ? ` · ${stamp(t.result)}${t.actual != null ? ` ${fmt(t.actual)}` : ""}` : "";
    $("#tcard").innerHTML = `<div class="tipcard">
      <div class="ctx">${day.toUpperCase()}${t.trial ? `<span class="tag trial">Preseason trial</span>` : ""}</div>
      <div class="who">${t.player}</div>
      <div class="ctx">${game}${t.game_start ? ` · tips off ${whenAEDT(t.game_start).split(",")[0]}` : ""}</div>
      <div class="bet">${tipBet(t)}</div>
      <div class="figs">
        <div class="fig"><div class="k">Our projection</div><div class="v ours ${sideCls(t.side)}">${fmt(t.model_proj)}</div></div>
        <div class="fig"><div class="k">Book line</div><div class="v">${fmt(t.line)}</div></div>
        <div class="fig"><div class="k">Edge ${sideGlyph(t.side)}</div><div class="v ${t.side}">${pct(t.edge)}</div></div>
      </div>
      <div class="foot">Posted ${t.posted_at ? whenAEDT(t.posted_at) : ""}${t.au_book ? "" : " · US line: no Australian book priced this player"}${closed ? " · " + closed : ""}${res}</div>
    </div>`;
  } else {
    $("#tlead").textContent = `No Drop is posted for ${day} yet. It goes up around `
      + `7pm Sydney time the night before the games, once the bookmakers' `
      + `player lines are up; if none clears the rules, there's no Drop.`;
  }

  const s = d.summary;
  // no preseason anywhere (owner, 16 Oct 2026): from opening night the
  // preseason trial Drops leave the record; they were never counted
  const seasonOn = new Date().toISOString().slice(0, 10) >= "2026-10-20";
  const tipsShown = d.tips.filter(r => !(seasonOn && r.trial));
  $("#tnote").textContent = seasonOn
    ? `Regular-season Drops only. Each Drop names its bookmaker; a US book stands in where no Australian book priced the player.`
      + (s.averages_public ? "" : ` The averages show once ${s.averages_from ?? 30} Drops are graded: one result is mostly luck.`)
    : s.n_tips
    ? `Regular-season Drops only; preseason trial Drops are listed below but not counted. Each Drop names its bookmaker; a US book stands in where no Australian book priced the player.`
    : `The record starts on opening night, 20 October (21 October AEDT). Preseason Drops are a trial run: listed, never counted. Each Drop names its bookmaker; a US book stands in where no Australian book priced the player.`;
  const open = s.averages_public, later = `<div class="r">${dropsLater(s)}</div>`;
  $("#tcards").innerHTML = `
    <div class="card"><div class="k">Avg CLV</div><div class="v">${open ? pct(s.avg_clv) : "—"}</div>${open ? `<div class="r">${s.n_clv} graded at the close</div>` : later}</div>
    <div class="card"><div class="k">Beat the close</div><div class="v">${open ? pct(s.beat_close) : "—"}</div>${open ? "" : later}</div>
    <div class="card"><div class="k">Covered–not</div><div class="v">${s.wins}–${s.losses}</div><div class="r">${s.pushes} push · ${s.voids} void</div></div>
    <div class="card"><div class="k">Units</div><div class="v ${unitsCls(s.units)}">${unitsTxt(s.units ?? 0)}</div><div class="r">1 unit on every Drop · ${s.n_graded ?? 0} graded</div></div>
    <div class="card"><div class="k">Hit rate</div><div class="v">${open ? pct(s.hit_rate) : "—"}</div>${open ? "" : later}</div>
    <div class="card"><div class="k">Return (flat)</div><div class="v">${open ? pct(s.roi) : "—"}</div>${open ? "" : later}</div>`;
  const tb = $("#tips tbody");
  tb.innerHTML = tipsShown.length ? tipsShown.map(r => `<tr class="${r.trial ? "trial" : ""}">
      <td class="s dim">${auDay(dayAfter(r.slate_date))}${r.trial ? " · trial" : ""}</td>
      <td class="s">${r.player}</td>
      <td class="s">${r.market_label} ${sideGlyph(r.side)} ${fmt(r.line)}</td>
      <td class="num opt">${odds(r.price)}</td>
      <td class="num opt">${r.closing_price != null ? (r.closing_line !== r.line ? fmt(r.closing_line) + " @ " : "") + odds(r.closing_price) : "—"}</td>
      <td class="num ${r.clv > 0 ? "pos" : r.clv < 0 ? "neg" : ""}">${pct(r.clv)}</td>
      <td class="num">${stamp(r.result)}${r.actual != null && r.result ? `<div class="sm dim">${fmt(r.actual)}</div>` : ""}</td>
      <td class="num ${unitsCls(r.units)}">${r.units != null ? unitsTxt(r.units) : `<span class="dim">${fmt(r.stake ?? 1, 0)}u</span>`}</td>
    </tr>`).join("")
    : `<tr><td colspan="8" class="empty">No Drops yet. The first goes up the
       night before the first preseason games.</td></tr>`;
}

function dayAfter(iso) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* ---------- Games section: shared ---------- */
/* The Australian date a slate is played on, from its first tip. */
function auDate(iso) {
  return new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney",
    weekday: "short", day: "numeric", month: "short" }).format(new Date(iso)).replace(",", "");
}
/* the slate's day in the reader's zone: "Fri 23 Oct" in Australia, "Thu Oct
   22" for a US reader (the schedule page keeps auDate, it's Australian time) */
const slateDay = iso => new Intl.DateTimeFormat(LOCALE(), { timeZone: SHOW_TZ(),
  weekday: "short", day: "numeric", month: "short" }).format(new Date(iso)).replace(/,/g, "");
const code = t => teamMeta(t)[0];
const signed = v => v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v));
/* "GSW −4.9": the favoured side and its spread, from a home line */
function favLine(g, homeLine) {
  if (homeLine == null) return "—";
  if (homeLine === 0) return "Pick'em";
  return homeLine < 0 ? `${code(g.home)} −${fmt(-homeLine)}` : `${code(g.away)} −${fmt(homeLine)}`;
}
function edgeSpan(r) {
  const over = r.side === "over";
  return `<span class="edge hot ${r.side}"><span class="ar">${over ? "▲" : "▼"}</span>${over ? "O" : "U"} ${pct(r.edge)}</span>`;
}

/* ---------- home ---------- */
async function initHome() {
  await renderFreshness();
  const [tips, board, gd, trackRec] = await Promise.all([
    loadJSON("data/tips.json").catch(() => null),
    loadData("projections").catch(() => null),
    loadData("games").catch(() => null),
    loadJSON("data/track_record.json").catch(() => null)]);
  // the record, in the open (brief §10): accuracy first, then the tip's CLV
  const pts = ((trackRec?.calibration?.markets) || []).find(m => m.stat === "PTS");
  const ps = pts?.windows?.season || {};
  const ts = tips?.summary || {};
  $("#hRecord").innerHTML = ps.n ? `<div class="cards">
    <div class="card"><div class="k">Points: average miss</div><div class="v">${fmt(ps.mae)}</div><div class="r">${ps.n.toLocaleString("en-AU")} player games</div></div>
    <div class="card"><div class="k">Inside our range</div><div class="v">${pct(ps.coverage)}</div><div class="r">target 80%</div></div>
    <div class="card"><div class="k">The Drop: avg CLV</div><div class="v">${ts.averages_public ? pct(ts.avg_clv) : "—"}</div><div class="r">${ts.averages_public ? `${ts.n_clv ?? 0} graded at the close` : dropsLater(ts)}</div></div>
    <div class="card"><div class="k">The Drop: covered–not</div><div class="v">${ts.wins ?? 0}–${ts.losses ?? 0}</div><div class="r"><a href="/track-record.html">Full record →</a></div></div></div>`
    : `<p class="dim">Every prediction is graded in the open from opening night, 20 October (21 October AEDT): how far off, whether the ranges hold, and the Drop's closing-line value. <a href="/track-record.html">How it's graded →</a></p>`;
  const games = gd?.games || [];
  if (games.length && games[0].start) $("#hday").textContent = `Tonight · ${slateDay(games[0].start)}`;

  const t = tips?.today;
  const rec = tips?.summary;
  $("#hTip").innerHTML = `<div class="ph2"><span>The Drop</span><a href="/tip.html">Record →</a></div>` + (t
    ? `<div class="tipmini">
        <div class="who">${esc(t.player)}</div>
        <div class="bet">${esc(t.market_label)} ${t.side === "over" ? "Over" : "Under"} <b>${fmt(t.line)}</b> @ <b>${odds(t.price)}</b>, ${esc(t.book_label)} · ${fmt(t.stake ?? 1, 0)} unit</div>
        <div class="sm">Our projection <b class="ours ${sideCls(t.side)}">${fmt(t.model_proj)}</b> · edge ${edgeSpan(t)}${t.trial ? ` · <span class="tag trial">Preseason trial</span>` : ""}</div>
      </div>`
    : `<p class="dim">Our biggest edge goes up around 7pm Sydney time the night before the games.</p>`)
    + (rec && rec.n_tips ? `<div class="sm dim">Season: ${rec.wins}–${rec.losses}, ${unitsTxt(rec.units ?? 0)} (1 unit each)</div>` : "");

  const rows = regionLines(board?.rows || []).map(favour).filter(r => r.edge != null && r.line != null && r.tier)
    .sort((a, b) => b.edge - a.edge).slice(0, 6);
  $("#hEdges").innerHTML = `<div class="ph2"><span>Biggest edges tonight</span><a href="/predictions.html">All predictions →</a></div>` + (rows.length
    ? `<table class="mini"><tbody>${rows.map(r => `<tr>
        <td class="s"><a href="${pHref(r.player_id)}">${esc(r.player)}</a> <span class="sm dim">${esc(STAT_WORD[r.stat] || r.stat)}</span></td>
        <td class="num"><span class="ours">${fmt(r.proj)}</span> <span class="dim">v ${fmt(r.line)}</span></td>
        <td class="num">${edgeSpan(r)}</td></tr>`).join("")}</tbody></table>`
    : `<p class="dim">Edges appear once the bookmakers post tonight's player lines.</p>`);

  $("#hGames").innerHTML = games.length ? games.map(g => `<a class="gmini" href="${gameHref(g)}">
      <div class="t">${g.start ? aedtTime(g.start) : ""}</div>
      <div class="m">${teamBadge(g.away)} <span class="dim">@</span> ${teamBadge(g.home)}</div>
      <div class="sm">${favLine(g, g.book_line_home)} · ${g.book_total == null ? "total —" : fmt(g.book_total)}</div>
      <div class="sm dim">${g.free_game ? "free game of the day" : g.book_line_home == null ? "lines to come" : "bookmaker line"} · prediction →</div>
    </a>`).join("")
    : `<p class="dim">No games tonight.</p>`;
}

/* the board, filtered to one game: its label there is "Home vs Away" */
/* a game's own page (dated, /nba/games/...), written by the pipeline; the
   board filtered to the game is linked from there */
// absolute: these links are built on pages under /players/ and /nba/ too
const gameHref = g => g.url || `/predictions.html?game=${encodeURIComponent(`${g.home} vs ${g.away}`)}`;
const boardHref = g => `/predictions.html?game=${encodeURIComponent(`${g.home} vs ${g.away}`)}`;
const TEAM_NICK = { Atlanta: "Hawks", Boston: "Celtics", Brooklyn: "Nets", Charlotte: "Hornets",
  Chicago: "Bulls", Cleveland: "Cavaliers", Dallas: "Mavericks", Denver: "Nuggets", Detroit: "Pistons",
  "Golden State": "Warriors", Houston: "Rockets", Indiana: "Pacers", "LA Clippers": "Clippers",
  "LA Lakers": "Lakers", Memphis: "Grizzlies", Miami: "Heat", Milwaukee: "Bucks", Minnesota: "Timberwolves",
  "New Orleans": "Pelicans", "New York": "Knicks", "Oklahoma City": "Thunder", Orlando: "Magic",
  Philadelphia: "76ers", Phoenix: "Suns", Portland: "Trail Blazers", Sacramento: "Kings",
  "San Antonio": "Spurs", Toronto: "Raptors", Utah: "Jazz", Washington: "Wizards" };
const nick = t => TEAM_NICK[t] || t;
const slugOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const teamHref = t => `teams/${slugOf(t)}.html`;
const pairHref = g => { const [x, y] = [nick(g.home), nick(g.away)].sort(); return `games/${slugOf(x)}-vs-${slugOf(y)}.html`; };

/* ---------- Game trends: shared ----------
   One row per team per completed game (data/trends.json, last season
   onward). Every situation is from the team's side. Rows are counted
   per team result; over/under per game, never twice. */
const SITUATIONS = [
  { k: "venue", label: "Venue", opts: [["all", "All"], ["home", "Home"], ["away", "Away"]],
    f: (r, v) => v === "all" || (v === "home") === r.home },
  { k: "prev", label: "After a", opts: [["all", "Any result"], ["win", "Win"], ["loss", "Loss"]],
    f: (r, v) => v === "all" || (r.prev_win != null && (v === "win") === r.prev_win) },
  { k: "role", label: "Favourite / underdog", opts: [["all", "All"], ["fav", "Favourite"], ["dog", "Underdog"],
      ["hfav", "Home favourite"], ["hdog", "Home underdog"], ["afav", "Away favourite"], ["adog", "Away underdog"]],
    f: (r, v) => { if (v === "all") return true; if (r.spread == null) return false;
      const fav = r.spread < 0, dog = r.spread > 0;
      return v === "fav" ? fav : v === "dog" ? dog : v === "hfav" ? fav && r.home : v === "hdog" ? dog && r.home
           : v === "afav" ? fav && !r.home : dog && !r.home; } },
  { k: "band", label: "Spread", opts: [["all", "All"], ["s", "0–3"], ["m", "3.5–7"], ["l", "7.5+"]],
    f: (r, v) => { if (v === "all") return true; if (r.spread == null) return false;
      const a = Math.abs(r.spread); return v === "s" ? a <= 3 : v === "m" ? a > 3 && a <= 7 : a > 7; } },
  { k: "total", label: "Total", opts: [["all", "All"], ["lo", "Under 220"], ["mid", "220–234.5"], ["hi", "235+"]],
    f: (r, v) => { if (v === "all") return true; if (r.total == null) return false;
      return v === "lo" ? r.total < 220 : v === "mid" ? r.total >= 220 && r.total < 235 : r.total >= 235; } },
  { k: "rest", label: "Rest", opts: [["all", "All"], ["0", "No rest (B2B)"], ["1", "1 day"], ["2", "2–3 days"], ["4", "4+ days"],
      ["adv", "Rest advantage"], ["dis", "Rest disadvantage"], ["eq", "Equal rest"], ["oppb2b", "Opponent on B2B"]],
    f: (r, v) => { if (v === "all") return true;
      if (v === "oppb2b") return r.opp_rest === 0;
      if (["adv", "dis", "eq"].includes(v)) { if (r.rest == null || r.opp_rest == null) return false;
        return v === "adv" ? r.rest > r.opp_rest : v === "dis" ? r.rest < r.opp_rest : r.rest === r.opp_rest; }
      if (r.rest == null) return false;
      return v === "0" ? r.rest === 0 : v === "1" ? r.rest === 1 : v === "2" ? r.rest >= 2 && r.rest <= 3 : r.rest >= 4; } },
  { k: "top3", label: "Top-3 minutes player", opts: [["all", "All"], ["out", "One missing"], ["in", "All playing"]],
    f: (r, v) => v === "all" || (v === "out") === !!r.missing_top3 },
  { k: "group", label: "Opponent", opts: [["all", "All"], ["conf", "Conference"], ["nconf", "Non-conference"], ["div", "Division"], ["ndiv", "Non-division"]],
    f: (r, v) => v === "all" || (v === "conf" ? r.conf : v === "nconf" ? !r.conf : v === "div" ? r.div : !r.div) },
  /* game type (owner, 16 Oct 2026): exact, from the season-phase dates;
     a game with no type is outside every known season and never counts
     (no preseason anywhere). Rendered beside Season and Time frame. */
  { k: "type", label: "Game type", opts: [["regular", "Regular season"], ["play_in", "Play-In"],
      ["playoffs", "Playoffs"], ["cup_final", "NBA Cup final"], ["all", "All games"]],
    f: (r, v) => { const ph = r.phase !== undefined ? r.phase : (r.post ? "playoffs" : "regular");
      return ph !== null && (v === "all" || ph === v); } },
  { k: "cup", label: "NBA Cup", opts: [["all", "All"], ["cup", "Cup games"], ["not", "Not Cup"]],
    f: (r, v) => v === "all" || (v === "cup") === !!r.cup },
];
const SIT_DEFAULT = Object.fromEntries(SITUATIONS.map(f => [f.k, f.k === "type" ? "regular" : "all"]));

const gameKey = r => r.date + "|" + (r.home ? r.team : r.opp);
function trendStats(rows) {
  const s = { n: rows.length, w: 0, l: 0, aw: 0, al: 0, ap: 0, o: 0, u: 0, p: 0, mv: 0, mvn: 0 };
  const seen = new Set();
  for (const r of rows) {
    const m = r.pts - r.opp_pts;
    m > 0 ? s.w++ : s.l++;
    if (r.spread != null) {
      const c = m + r.spread;
      c > 0 ? s.aw++ : c < 0 ? s.al++ : s.ap++;
      s.mv += c; s.mvn++;
    }
    const k = gameKey(r);
    if (r.total != null && !seen.has(k)) {
      seen.add(k);
      const t = r.pts + r.opp_pts;
      t > r.total ? s.o++ : t < r.total ? s.u++ : s.p++;
    }
  }
  s.games = new Set(rows.map(gameKey)).size;
  s.ats_pct = (s.aw + s.al) ? s.aw / (s.aw + s.al) : null;
  s.ov_pct = (s.o + s.u) ? s.o / (s.o + s.u) : null;
  s.mvs = s.mvn ? s.mv / s.mvn : null;
  return s;
}
const rec = (a, b, c) => `${a}–${b}${c ? `–${c}` : ""}`;

/* season, time frame and game type (owner, 16 Oct 2026). The season is
   exact (2026-27 by default; last season until the first game of this one).
   The time frame is the whole season, its last 14 or 30 days, or a date
   range (the pickers appear only then). Game type lives in the situations
   state (state.type) but sits here, beside the other two. */
const seasonOfIso = iso => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7), s0 = m >= 8 ? y : y - 1;
  return `${s0}-${String(s0 + 1).slice(2)}`; };
function dateRangeControl(el, data, onChange, state) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = (data.rows || []).filter(r => r.phase !== null);
  const sea = r => r.season || seasonOfIso(r.date);
  const cur = seasonOfIso(today);
  const has = sn => rows.some(r => sea(r) === sn);
  const seasons = [...new Set([cur, ...rows.map(sea)])].sort().reverse();
  const st = { season: has(cur) ? cur : (seasons.find(has) || cur), frame: "season", from: "", to: "" };
  const fallback = st.season !== cur;
  const shift = (iso, days) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const inSeason = r => st.season === "all" || sea(r) === st.season;
  const typeF = SITUATIONS.find(f => f.k === "type");
  // a past season's "last 30 days" ends at its last game of the chosen type
  const bounds = () => { const ds = rows.filter(r => inSeason(r) && (!state || typeF.f(r, state.type)))
      .map(r => r.date).sort();
    return [ds[0] || today, ds[ds.length - 1] || today]; };
  el.innerHTML = `<div class="daterange">
    <label class="fsel"><span>Season</span><select id="drSeason">${seasons.map(sn =>
      `<option value="${sn}"${sn === st.season ? " selected" : ""}>${sn}</option>`).join("")}<option value="all">All seasons</option></select></label>
    <label class="fsel"><span>Time frame</span><select id="drFrame"><option value="season">Whole season</option>
      <option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="range">Date range</option></select></label>
    ${state ? `<label class="fsel"><span>${typeF.label}</span><select id="drType">${typeF.opts.map(([v, t]) =>
      `<option value="${v}"${state.type === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>` : ""}
    <div class="dates" id="drDates" hidden>
      <label>From <input type="date" id="drFrom"></label>
      <label>To <input type="date" id="drTo"></label>
    </div>
  </div>`;
  const setDates = () => { const [lo, hi] = bounds();
    for (const id of ["drFrom", "drTo"]) { const i = $("#" + id, el); i.min = lo; i.max = hi; }
    st.from = $("#drFrom", el).value = lo; st.to = $("#drTo", el).value = hi; };
  el.onchange = e => {
    const id = e.target.id;
    if (id === "drSeason") { st.season = e.target.value; setDates(); }
    if (id === "drFrame") { st.frame = e.target.value; $("#drDates", el).hidden = st.frame !== "range"; if (st.frame === "range") setDates(); }
    if (id === "drType" && state) state.type = e.target.value;
    if (id === "drFrom") st.from = e.target.value;
    if (id === "drTo") st.to = e.target.value;
    onChange();
  };
  return {
    state: st,
    inRange: r => {
      if (r.phase === null || !inSeason(r)) return false;
      if (st.frame === "14" || st.frame === "30") {
        const anchor = st.season === cur || st.season === "all" ? today : bounds()[1];
        return r.date >= shift(anchor, -+st.frame) && r.date <= anchor;
      }
      if (st.frame === "range") return r.date >= st.from && r.date <= st.to;
      return true;
    },
    label: () => st.frame === "range" ? `from ${auDay(st.from)} to ${auDay(st.to)}`
      : st.frame === "season" ? (st.season === "all" ? "across all seasons" : `in ${st.season}`)
      : `over the last ${st.frame} days${st.season === cur || st.season === "all" ? "" : ` of ${st.season}`}`,
    note: () => fallback && st.season !== cur && !has(cur)
      ? ` No ${cur} games yet: showing ${st.season} until opening night.` : "",
  };
}
function situationControls(el, state, filters = SITUATIONS, onChange) {
  el.innerHTML = filters.filter(f => f.k !== "type").map(f => `<label class="fsel"><span>${f.label}</span>
    <select data-k="${f.k}">${f.opts.map(([v, t]) => `<option value="${v}"${state[f.k] === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>`).join("");
  el.onchange = e => { state[e.target.dataset.k] = e.target.value; onChange(); };
}
const SIT_PHRASE = { venue: { home: "at home", away: "away" }, prev: { win: "after a win", loss: "after a loss" },
  role: { fav: "as favourite", dog: "as underdog", hfav: "as home favourite", hdog: "as home underdog", afav: "as away favourite", adog: "as away underdog" },
  band: { s: "spread 0–3", m: "spread 3.5–7", l: "spread 7.5+" }, total: { lo: "total under 220", mid: "total 220–234.5", hi: "total 235+" },
  rest: { "0": "on no rest", "1": "on 1 day's rest", "2": "on 2–3 days' rest", "4": "on 4+ days' rest", adv: "with a rest advantage", dis: "with a rest disadvantage", eq: "on equal rest", oppb2b: "v an opponent on a back-to-back" },
  top3: { out: "missing a top-3 player", in: "at full strength" }, group: { conf: "v conference", nconf: "v non-conference", div: "v division", ndiv: "v non-division" },
  type: { play_in: "in the play-in", playoffs: "in the playoffs", cup_final: "in the NBA Cup final", all: "in all games" },
  cup: { cup: "NBA Cup games", not: "outside the NBA Cup" } };
const situationLabel = state => SITUATIONS.filter(f => state[f.k] !== "all" && !(f.k === "type" && state[f.k] === "regular"))
  .map(f => (SIT_PHRASE[f.k] || {})[state[f.k]] || f.opts.find(o => o[0] === state[f.k])[1].toLowerCase());

/* tonight's situation for one side of a game, from the bookmaker line and rest */
function tonightSituation(g, team, rows) {
  const home = g.home === team;
  const line = g.book_line_home == null ? null : (home ? g.book_line_home : -g.book_line_home);
  const mine = rows.filter(r => r.team === team).sort((a, b) => a.date < b.date ? 1 : -1);
  const last = mine[0];
  const rest = last && g.start ? Math.round((new Date(g.start) - new Date(last.date + "T23:00:00Z")) / 864e5) - 1 : null;
  const s = { ...SIT_DEFAULT, venue: home ? "home" : "away" };
  if (line != null) s.role = line < 0 ? (home ? "hfav" : "afav") : line > 0 ? (home ? "hdog" : "adog") : "all";
  if (line != null) { const a = Math.abs(line); s.band = a <= 3 ? "s" : a <= 7 ? "m" : "l"; }
  if (rest != null && rest >= 0 && rest <= 5) s.rest = rest === 0 ? "0" : rest === 1 ? "1" : rest <= 3 ? "2" : "4";
  if (last) s.prev = last.pts > last.opp_pts ? "win" : "loss";
  return s;
}
function trendLine(label, st) {
  if (!st.n) return `<li class="dim">${esc(label)}: no games yet</li>`;
  return `<li><span class="lbl">${esc(label)}</span> <b>${rec(st.w, st.l)}</b> straight up, <b>${rec(st.aw, st.al, st.ap)}</b> ATS, ` +
    `overs <b>${rec(st.o, st.u, st.p)}</b>${st.mvs != null ? `, ${signed(st.mvs)} v spread` : ""} <span class="dim">n=${st.n}</span></li>`;
}
/* up to three lines for a side: tonight's full situation, then each of its parts that has games */
function sideTrends(team, sit, rows, inRange) {
  const mine = rows.filter(r => r.team === team && inRange(r));
  const applies = st => mine.filter(r => SITUATIONS.every(f => f.f(r, st[f.k])));
  const lines = [];
  const full = applies(sit), fullLabel = situationLabel(sit).join(", ");
  lines.push([fullLabel ? `Tonight's situation (${fullLabel})` : "Tonight's situation", trendStats(full)]);
  for (const k of ["venue", "role", "rest", "prev"]) {
    if (sit[k] === "all" || (k === "role" && sit.band !== "all" && false)) continue;
    const st = { ...SIT_DEFAULT, [k]: sit[k] };
    const label = (SIT_PHRASE[k] || {})[sit[k]] || SITUATIONS.find(f => f.k === k).opts.find(o => o[0] === sit[k])[1];
    lines.push([label[0].toUpperCase() + label.slice(1), trendStats(applies(st))]);
  }
  lines.push(["All games", trendStats(mine)]);
  return lines.slice(0, 5).map(([l, st]) => trendLine(l, st)).join("");
}
/* the standout trends for one game: at most two bullets, only when a side's
   record in tonight's situation (or one of its parts) is lopsided over
   enough games — otherwise just the line (owner, 11 Oct 2026) */
const INSIGHT_MIN_N = 10, INSIGHT_EDGE = 0.15;   // 65%+ or 35%- on 10+ games
function gameInsights(g, rows, inRange) {
  const found = [];
  for (const t of [g.away, g.home]) {
    const sit = tonightSituation(g, t, rows);
    const mine = rows.filter(r => r.team === t && inRange(r));
    const applies = st => mine.filter(r => SITUATIONS.every(f => f.f(r, st[f.k])));
    const cands = [[situationLabel(sit).join(", "), applies(sit)]];
    for (const k of ["venue", "role", "rest", "prev"]) {
      if (sit[k] === "all") continue;
      const st = { ...SIT_DEFAULT, [k]: sit[k] };
      cands.push([(SIT_PHRASE[k] || {})[sit[k]] || "", applies(st)]);
    }
    for (const [label, got] of cands) {
      const st = trendStats(got);
      if (st.n < INSIGHT_MIN_N) continue;
      const ats = st.aw + st.al ? st.aw / (st.aw + st.al) : 0.5;
      const ov = st.o + st.u ? st.o / (st.o + st.u) : 0.5;
      if (Math.abs(ats - 0.5) >= INSIGHT_EDGE)
        found.push({ score: Math.abs(ats - 0.5) * Math.sqrt(st.n),
          text: `${esc(nick(t))} are <b>${rec(st.aw, st.al, st.ap)}</b> against the spread ${esc(label)} <span class="dim">(${st.n} games)</span>` });
      if (Math.abs(ov - 0.5) >= INSIGHT_EDGE)
        found.push({ score: Math.abs(ov - 0.5) * Math.sqrt(st.n),
          text: `${esc(nick(t))} games have gone <b>${ov > 0.5 ? "over" : "under"} ${rec(ov > 0.5 ? st.o : st.u, ov > 0.5 ? st.u : st.o, st.p)}</b> ${esc(label)} <span class="dim">(${st.n} games)</span>` });
    }
  }
  const seen = new Set();
  return found.sort((a, b) => b.score - a.score).filter(f => !seen.has(f.text) && seen.add(f.text)).slice(0, 2);
}
function gameCard(g, rows, inRange) {
  const ins = gameInsights(g, rows, inRange);
  return `<article class="game" id="g${esc(g.event_id)}">
    <header><span class="t">${g.start ? whenAEDT(g.start) : ""} · ${teamBadge(g.away)} ${esc(nick(g.away))} <span class="dim">@</span> ${teamBadge(g.home)} ${esc(nick(g.home))}</span>
      <span class="line">${g.book_line_home == null ? "lines to come" : `${favLine(g, g.book_line_home)} · total ${fmt(g.book_total)}`}</span></header>
    ${ins.length ? `<ul class="trend">${ins.map(i => `<li>${i.text}</li>`).join("")}</ul>` : `<p class="sm dim">Nothing lopsided in either side's situation.</p>`}
    <p class="sm"><a href="${gameHref(g)}">Game page →</a> · <a href="${boardHref(g)}">Player predictions</a></p>
  </article>`;
}

/* ---------- Game trends page ---------- */
async function initTrends() {
  await renderFreshness();
  const [d, gd] = await Promise.all([loadJSON("data/trends.json"), loadData("games").catch(() => null)]);
  const all = d.rows || [];
  const games = gd?.games || [];
  const state = { ...SIT_DEFAULT };
  let range;
  const render = () => {
    const rows = all.filter(r => range.inRange(r) && SITUATIONS.every(f => f.f(r, state[f.k])));
    const on = situationLabel(state);
    // unfiltered, every game counts once per side and ATS is 50% by
    // construction: the headline reads from the home side instead
    const who = on.length ? rows : rows.filter(r => r.home);
    const s = trendStats(who), ou = trendStats(rows);
    const subject = on.length ? `Teams (${esc(on.join(", "))})` : "Home teams";
    $("#tlead").innerHTML = !all.length
      ? `Game trends start with the first games of the season.`
      : `${subject} are <b>${rec(s.aw, s.al, s.ap)}</b> against the spread, ${range.label()}; `
        + `these games have gone <b>${rec(ou.o, ou.u)}</b> over/under (${ou.games} game${ou.games === 1 ? "" : "s"}).${range.note()}`;
    $("#tcards").innerHTML = `
      <div class="card"><div class="k">Games</div><div class="v">${ou.games}</div><div class="r">${s.n} team results</div></div>
      <div class="card"><div class="k">ATS${on.length ? "" : ", home"}</div><div class="v">${rec(s.aw, s.al)}</div><div class="r">${pct(s.ats_pct)} · ${s.ap} push</div></div>
      <div class="card"><div class="k">Over–under</div><div class="v">${rec(ou.o, ou.u)}</div><div class="r">${pct(ou.ov_pct)} overs</div></div>
      <div class="card"><div class="k">Straight up${on.length ? "" : ", home"}</div><div class="v">${rec(s.w, s.l)}</div></div>
      <div class="card"><div class="k">Vs spread${on.length ? "" : ", home"}</div><div class="v">${signed(s.mvs)}</div><div class="r">avg pts</div></div>`;
    const by = {};
    rows.forEach(r => (by[r.team] = by[r.team] || []).push(r));
    let teams = Object.entries(by).map(([team, rs]) => ({ team, ...trendStats(rs) }));
    const small = $("#small").checked;
    const hidden = teams.filter(t => t.n < 5).length;
    if (!small) teams = teams.filter(t => t.n >= 5);
    teams.sort((a, b) => { const x = a[sortKey], y = b[sortKey];
      if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * sortDir; });
    $("#trends tbody").innerHTML = teams.length ? teams.map(t => `<tr class="${t.n < 10 ? "thin" : ""}">
      <td class="s"><a href="${teamHref(t.team)}">${teamBadge(t.team)} <span class="tn">${esc(t.team)}</span></a></td>
      <td class="num">${t.n}</td>
      <td class="num">${rec(t.w, t.l)}</td>
      <td class="num">${rec(t.aw, t.al, t.ap)}<div class="sm dim">${pct(t.ats_pct)}</div></td>
      <td class="num opt">${rec(t.o, t.u, t.p)}<div class="sm dim">${pct(t.ov_pct)}</div></td>
      <td class="num ${t.mvs > 0 ? "pos" : ""}">${signed(t.mvs)}</td></tr>`).join("")
      : `<tr><td colspan="6" class="empty">${all.length
        ? `No team has 5 games in this situation and range${hidden ? ` (${hidden} with fewer: tick the box above)` : ""}.`
        : "No games yet."}</td></tr>`;
    $("#small").parentElement.lastChild.textContent = ` Show teams with fewer than 5 games${hidden && !small ? ` (${hidden} hidden)` : ""}`;
    // tonight's games, each side in tonight's situation over the chosen range
    const tonight = $("#tonight");
    if (tonight) tonight.innerHTML = games.length
      ? games.map(g => gameCard(g, all, range.inRange)).join("")
      : `<p class="dim">No games tonight. The table above covers every team.</p>`;
  };
  let sortKey = "ats_pct", sortDir = -1;
  range = dateRangeControl($("#trange"), d, render, state);
  situationControls($("#tfilters"), state, SITUATIONS, render);
  $("#small").addEventListener("change", render);
  $$("#trends th[data-k]").forEach(th => th.addEventListener("click", () => {
    const k = th.dataset.k; sortDir = sortKey === k ? -sortDir : (k === "team" ? 1 : -1); sortKey = k; render();
  }));
  if (games.length && games[0].start) $("#tday").textContent = slateDay(games[0].start);
  render();
}

/* ---------- team page: the game log, filters, with / without ---------- */
/* a compact multi-select: a button that opens a checklist (native multi-
   selects are unusable on a phone) */
function multiSelect(el, label, options, onChange) {
  const picked = new Set();
  el.innerHTML = `<details class="msel"><summary><span class="k">${esc(label)}</span><span class="v">Anyone</span></summary>
    <div class="list">${options.map(o => `<label><input type="checkbox" value="${esc(o)}"> ${esc(o)}</label>`).join("")}</div></details>`;
  const det = $("details", el), v = $(".v", el);
  det.addEventListener("change", e => {
    if (e.target.checked) picked.add(e.target.value); else picked.delete(e.target.value);
    v.textContent = picked.size ? [...picked].join(", ") : "Anyone";
    onChange();
  });
  document.addEventListener("click", e => { if (!det.contains(e.target)) det.open = false; });
  return picked;
}
async function initTeam() {
  await renderFreshness();
  const team = document.body.dataset.team;
  const [d, gd] = await Promise.all([loadJSON("data/trends.json"), loadData("games").catch(() => null)]);
  const mine = (d.rows || []).filter(r => r.team === team).sort((a, b) => a.date < b.date ? 1 : -1);
  const seasons = (d.seasons || []).slice().reverse();
  const rotation = d.rotation?.[team] || {};
  const players = [...new Set(seasons.flatMap(s => rotation[s] || []))];
  const state = { ...SIT_DEFAULT };
  let range, withP = new Set(), withoutP = new Set();
  const tonight = (gd?.games || []).find(g => g.home === team || g.away === team);
  const render = () => {
    let rows = mine.filter(r => range.inRange(r) && SITUATIONS.every(f => f.f(r, state[f.k])));
    if (withoutP.size) rows = rows.filter(r => [...withoutP].every(p => r.absent.includes(p)));
    // "with X": X played in that game (a mid-season arrival isn't "with"
    // before he joined); rows from before `played` existed, or with no
    // rotation yet (an empty list), fall back to "not listed absent"
    if (withP.size) rows = rows.filter(r => [...withP].every(p =>
      r.played && r.played.length ? r.played.includes(p) : !r.absent.includes(p)));
    const st = trendStats(rows);
    const on = situationLabel(state);
    const who = [nick(team), ...(withP.size ? [`with ${[...withP].join(", ")}`] : []),
                 ...(withoutP.size ? [`without ${[...withoutP].join(", ")}`] : []), ...on].join(", ");
    $("#tmlead").innerHTML = st.n
      ? `${esc(who)}: <b>${rec(st.w, st.l)}</b> straight up, <b>${rec(st.aw, st.al, st.ap)}</b> against the spread, `
        + `overs <b>${rec(st.o, st.u, st.p)}</b>, ${range.label()} (${st.n} games).`
      : `${esc(who)}: no games match, ${range.label()}.`;
    $("#tmcards").innerHTML = `
      <div class="card"><div class="k">Games</div><div class="v">${st.n}</div></div>
      <div class="card"><div class="k">Straight up</div><div class="v">${rec(st.w, st.l)}</div></div>
      <div class="card"><div class="k">ATS</div><div class="v">${rec(st.aw, st.al)}</div><div class="r">${pct(st.ats_pct)} · ${st.ap} push</div></div>
      <div class="card"><div class="k">Over–under</div><div class="v">${rec(st.o, st.u)}</div><div class="r">${pct(st.ov_pct)} overs</div></div>
      <div class="card"><div class="k">Vs spread</div><div class="v">${signed(st.mvs)}</div><div class="r">avg pts</div></div>`;
    $("#glog tbody").innerHTML = rows.length ? rows.map(r => {
      const m = r.pts - r.opp_pts, c = r.spread == null ? null : m + r.spread, t = r.pts + r.opp_pts;
      return `<tr>
        <td class="s">${auDay(r.date)}${r.post ? ' <span class="dim">po</span>' : ""}${r.cup ? ' <span class="dim">cup</span>' : ""}</td>
        <td class="s">${r.home ? "v" : "@"} <a href="${teamHref(r.opp)}">${teamBadge(r.opp)}</a></td>
        <td class="num ${m > 0 ? "pos" : "neg"}">${m > 0 ? "W" : "L"} <span class="dim">${r.pts}–${r.opp_pts}</span></td>
        <td class="num">${r.spread == null ? "—" : (r.spread > 0 ? "+" : "") + fmt(r.spread)}</td>
        <td class="num ${c == null ? "dim" : c > 0 ? "pos" : c < 0 ? "neg" : ""}">${c == null ? "—" : c > 0 ? "✓" : c < 0 ? "✗" : "push"}</td>
        <td class="num">${r.total == null ? "—" : fmt(r.total)} <span class="dim">${t}</span></td>
        <td class="num ${r.total == null ? "dim" : t > r.total ? "pos" : t < r.total ? "neg" : ""}">${r.total == null ? "—" : t > r.total ? "O" : t < r.total ? "U" : "push"}</td>
        <td class="num dim opt">${r.rest == null ? "—" : r.rest}</td>
        <td class="s sm">${r.absent.map(esc).join(", ")}</td></tr>`; }).join("")
      : `<tr><td colspan="9" class="empty">No games match.</td></tr>`;
    const CAP = 25, trs = $$("#glog tbody tr");
    if (trs.length > CAP && !showAll) {
      trs.slice(CAP).forEach(t => t.hidden = true);
      $("#glog tbody").insertAdjacentHTML("beforeend", `<tr class="moreRow"><td colspan="9" class="s"><a href="#" id="glogAll">Show all ${trs.length} games →</a></td></tr>`);
      $("#glogAll").onclick = e => { e.preventDefault(); showAll = true; render(); };
    }
  };
  let showAll = false;
  range = dateRangeControl($("#tmrange"), { rows: mine }, render, state);
  situationControls($("#tmfilters"), state, SITUATIONS, render);
  if (players.length) {
    $("#tmww").innerHTML = `<div id="wwWith"></div><div id="wwWithout"></div>`;
    withP = multiSelect($("#wwWith"), "With", players, render);
    withoutP = multiSelect($("#wwWithout"), "Without", players, render);
  }
  if (tonight) {
    const sit = tonightSituation(tonight, team, d.rows || []);
    const opp = tonight.home === team ? tonight.away : tonight.home;
    $("#tmtonight").innerHTML = `<div class="game"><header><span class="t">Tonight: ${tonight.away === team ? "at" : "v"} ${esc(nick(opp))}, ${
      tonight.start ? whenAEDT(tonight.start) : ""}</span><span class="line">${tonight.book_line_home != null
      ? `${favLine(tonight, tonight.book_line_home)} · total ${fmt(tonight.book_total)}` : "lines to come"}</span></header>
      <ul class="trend">${sideTrends(team, sit, d.rows || [], range.inRange)}</ul>
      <p class="sm"><a href="${gameHref(tonight)}">Game page →</a> · <a href="${boardHref(tonight)}">Player predictions</a></p></div>`;
  }
  render();
}

/* ---------- schedule (AEDT) ---------- */
async function initSchedule() {
  await renderFreshness();
  const d = await loadData("games");
  const games = d.games || [];
  if (!games.length) { $("#sclead").textContent = "No NBA games today."; return; }
  const first = games.find(g => g.start);
  $("#sclead").innerHTML = `There ${games.length === 1 ? "is 1 NBA game" : `are ${games.length} NBA games`} today`
    + (first ? ` (${auDate(first.start)}); the first tips off at <b>${whenAEDT(first.start).split(",")[0]}</b>.` : ".");
  $("#sched tbody").innerHTML = games.map(g => `<tr>
      <td class="s">${g.start ? whenAEDT(g.start).split(",")[0] : "—"}</td>
      <td class="s"><a href="${gameHref(g)}">${teamBadge(g.away)} <span class="tn">${esc(g.away)}</span> <span class="dim">@</span> ${teamBadge(g.home)} <span class="tn">${esc(g.home)}</span></a></td>
      <td class="num">${favLine(g, g.book_line_home)}</td>
      <td class="num">${g.book_total == null ? "—" : fmt(g.book_total)}</td></tr>`).join("");
}

/* ---------- founding-member interest (every page) ----------
   Owner's call (29 Sep 2026): no tip or newsletter emails. The list gets
   one email, when founding memberships open.
   Posts to the `subscribe` edge function, which keeps the list in our own
   database and adds it to Beehiiv. The key below is Supabase's public
   anon key: it can only call functions, and nothing in the database is
   readable with it. `website` is a honeypot people never see. */
const SIGNUP = {
  url: "https://gpupsgkyyldqyfemtjml.supabase.co/functions/v1/subscribe",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwdXBzZ2t5eWxkcXlmZW10am1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDQ5NjQsImV4cCI6MjA5NzMyMDk2NH0.QKumwzupWA_61YodHozZmHE32HTIlHnoquXxaNzlvBA",
};

function mountSignup() {
  const foot = $("footer.rg");
  if (!foot || $("#signup")) return;
  const el = document.createElement("section");
  el.className = "signup";
  el.id = "signup";
  el.innerHTML = `
    <div class="su-copy"><b>Email before 1 December: season one for ${US ? "US$49 (A$69), not US$69" : "A$69 (US$49), not A$99"}.</b>
      <span>Leave your email and we'll send the offer when memberships open. One email, nothing else.</span></div>
    <form id="suForm" novalidate>
      <label class="vh" for="suEmail">Email address</label>
      <input id="suEmail" type="email" autocomplete="email" placeholder="you@example.com" required>
      <input id="suWebsite" class="vh" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button id="suBtn" type="submit">Sign up</button>
    </form>
    <p class="su-msg" id="suMsg" role="status"></p>
    <p class="su-fine">Used only to send the offer when memberships open. The early-bird season pass is ${US ? "US$49 or A$69" : "A$69 or US$49"} for season one (1 December to the Finals); there is no lifetime rate. <a href="/privacy.html">Privacy</a></p>`;
  foot.before(el);
  $("#suForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    const email = $("#suEmail").value.trim();
    const msg = $("#suMsg"), btn = $("#suBtn");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      msg.textContent = "That email address doesn't look right."; msg.className = "su-msg err"; return;
    }
    btn.disabled = true; btn.textContent = "Signing up…"; msg.textContent = "";
    try {
      const r = await fetch(SIGNUP.url, { method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SIGNUP.key}` },
        body: JSON.stringify({ email, page: location.pathname, website: $("#suWebsite").value }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        $("#suForm").hidden = true;
        msg.textContent = "You're on the list. We'll email you once, when memberships open."; msg.className = "su-msg ok";
        window.dcEvent?.("sign_up", { method: "email", source_page: location.pathname });
      } else {
        msg.textContent = d.error || "That didn't go through. Try again in a minute."; msg.className = "su-msg err";
      }
    } catch {
      msg.textContent = "That didn't go through. Try again in a minute."; msg.className = "su-msg err";
    } finally { btn.disabled = false; btn.textContent = "Sign up"; }
  });
}
addEventListener("DOMContentLoaded", mountSignup);

/* ---------- boot ---------- */
addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  const boot = { board: initBoard, player: initPlayer, players: initPlayers,
                 wow: initWow, record: initRecord, tip: initTip,
                 home: initHome, trends: initTrends, team: initTeam, schedule: initSchedule,
                 matchups: initMatchups, boxscore: initBoxscore }[page];
  if (boot) playerPagesReady.then(() => boot()).catch(e => {
    console.error(e);
    const st = $("#pstatic");
    if (st) { st.hidden = false; return; }      // a name page: its own tables stand
    const m = $("main");
    if (m) m.innerHTML = `<div class="empty">This page's numbers aren't
      published yet. The morning run publishes them here.</div>`;
  });
});

/* ---------- region: apply it, and the footer switch ---------- */
(function regionSetup() {
  const foot = $("footer.rg");
  if (foot) {
    const sw = document.createElement("p");
    sw.className = "regionsw";
    const btn = (r, label) => `<button type="button" data-r="${r}" aria-pressed="${REGION === r}">${label}</button>`;
    sw.innerHTML = `Showing the site for ${btn("au", "Australia")} · ${btn("us", "the US")}`;
    (foot.querySelector(".social") || foot.lastElementChild)?.before(sw);
    sw.addEventListener("click", ev => {
      const r = ev.target.closest("button")?.dataset.r;
      if (!r || r === REGION) return;
      try { localStorage.setItem(REGION_KEY, r); } catch { /* this visit only */ }
      location.reload();
    });
  }
  if (!US) return;
  document.documentElement.lang = "en-US";
  // the US help line first
  const rg = $("footer.rg .rgline");
  if (rg && /1800 858 858/.test(rg.textContent) && /1-800-GAMBLER/.test(rg.textContent))
    rg.innerHTML = `<b>21+</b> Gambling problem? Call 1-800-GAMBLER (US) · <b>18+</b> Gamble responsibly · `
      + `<a href="https://www.gamblinghelponline.org.au">Gambling Help Online</a> 1800 858 858 (AU)`;
  regionPass(document.body);
  // tables and cards drawn later (data loads after the page) get the same pass
  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 || n.nodeType === 3) regionPass(n);
  }).observe(document.body, { childList: true, subtree: true });
})();
