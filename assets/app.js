/* thetipoff — shared page logic. Vanilla JS, no deps. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- theme ---------- */
(function themeInit() {
  const saved = localStorage.getItem("theme");
  if (saved) document.documentElement.dataset.theme = saved;
  addEventListener("DOMContentLoaded", () => {
    const btn = $("#themeBtn");
    if (!btn) return;
    btn.onclick = () => {
      const cur = document.documentElement.dataset.theme || "dark";  // dark-first
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("theme", next);
    };
  });
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

/** Small colour chip with the team code — for table cells. */
function teamBadge(team, { withName = false } = {}) {
  if (!team) return "";
  const [abbr, c1, c2] = teamMeta(team);
  return `<span class="tbadge" style="background:${c1};color:${inkOn(c1)};
    border-color:${c2}" title="${esc(team)}">${abbr}</span>` +
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
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
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

/* "9:30am AEDT, Thu 8 Jan" — readers are in Australia */
function whenAEDT(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || "";
  const day = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney",
    weekday: "short", day: "numeric", month: "short" }).format(d);
  const zone = (new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney",
    timeZoneName: "short" }).formatToParts(d).find(p => p.type === "timeZoneName")
    || {}).value || "";
  return `${aedtTime(iso)} ${zone.replace(/^GMT\+11$/, "AEDT").replace(/^GMT\+10$/, "AEST")}, ${day.replace(",", "")}`;
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
      (m.lines_region === "us"
        ? `<span>Lines from <b>US bookmakers</b> until Australian books price NBA player props</span>`
        : m.lines_region === "au" ? `<span>Lines from <b>Australian bookmakers</b></span>` : "") +
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
  return `<td class="s pl"><a href="player.html?id=${r.player_id}">${esc(r.player)}</a>
    <div class="sm">${teamBadge(r.team)}${esc(opp)}${
      r.minutes != null ? ` · ${fmt(r.minutes)} min` : ""}${
      r.minutes_source && r.minutes_source !== "model"
        ? ` <span class="badge src">${esc(r.minutes_source)}</span>` : ""}</div>${wwNote(r)}</td>`;
}
function predTd(r) {
  return `<td class="num pred">${predCell(r, true)}<div class="sm">${
    fmt(r.floor, 0)}–${fmt(r.ceiling, 0)}</div></td>`;
}
/* A side is called only on a clear edge (3%+; internal threshold, never shown as a tier). Below that, the value
   side can come from the price rather than the line — an under at 2.29
   with our prediction above the line — which reads as a contradiction. */
function lineTd(r) {
  if (r.line == null) return `<td class="num dim">—</td>`;
  return `<td class="num"><span class="side">${fmt(r.line)}</span>${
    r.price != null ? `<div class="sm" title="${r.book ? esc(r.book) : ""}">@ ${fmt(r.price, 2)}</div>` : ""}</td>`;
}
function diffTd(r) {
  if (r.diff == null) return `<td class="num dim opt">—</td>`;
  return `<td class="num opt" title="our prediction minus the line, and as a % of the line">${
    r.diff > 0 ? "+" : ""}${fmt(r.diff)}<div class="sm">${
    r.diff_pct > 0 ? "+" : ""}${(r.diff_pct * 100).toFixed(0)}%</div></td>`;
}
function priceTd(r) {
  if (r.price == null) return `<td class="num dim">—</td>`;
  return `<td class="num">${fmt(r.price, 2)}${r.book
    ? `<div class="sm l">${esc(r.book)}</div>` : ""}</td>`;
}
/* The edge carries its side — "▼U 11.3%" — so an under never reads as an
   over. Only a clear edge (3%+) names a side; below that the value
   side can come from the price rather than the line, so it's shown
   muted and unsided. */
function edgeTd(r) {
  if (r.edge == null) return `<td class="num dim">—</td>`;
  const over = r.side === "over";
  const label = r.tier
    ? `<span class="ar">${over ? "▲" : "▼"}</span>${over ? "O" : "U"} ${pct(r.edge)}`
    : pct(r.edge);
  return `<td class="num"><span class="edge ${r.tier ? `hot ${r.side}` : "cold"}" title="${r.tier
    ? `The ${r.side} ${r.line} at ${fmt(r.price, 2)}: our probability beats the bookmaker's (margin removed) by ${pct(r.edge)}`
    : "Below the threshold we'd call an edge"}">${label}</span>${r.diff != null
    ? `<div class="sm ph">diff ${r.diff > 0 ? "+" : ""}${fmt(r.diff)}</div>` : ""}</td>`;
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
  ["proj", "Pred", false, "our prediction, with its 10th–90th percentile range"],
  ["line", "Line", false, "bookmaker line and price for the side we lean"],
  ["adiff", "Diff", false, "our prediction minus the line (sorts by size, overs and unders alike)", true],
  ["edge", "Edge", false, "our probability minus the bookmaker's (margin removed), with the side it is on; green = a real edge"],
  ["mu", "Matchup", false, "what tonight's opponent gives up to his position, and its rank (1st = softest)", true],
  ["l10_hit", "Hit L10", false, "how often our side landed in his last 10 games", true],
];

/* How the boards are ordered. Edge is the default: it is the difference
   scaled by how much the player's number swings and by the price, so a
   2-point gap at 1.91 outranks a 2-point gap the bookmaker has already
   priced in at 1.64, and a 0.5 line can't win on percentage alone.
   Rows without a line fall to the bottom, biggest prediction first. */
const SORTS = { edge: "Edge", adiff: "Diff", adpct: "Diff %", proj: "Prediction" };
let boardSort = "edge";

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
        ${playerCell(r)}${predTd(r)}${lineTd(r)}${diffTd(r)}${edgeTd(r)}${muTd(r)}${hitTd(r)}
      </tr>`).join("")
    : `<tr><td colspan="7" class="empty">No players match.</td></tr>`;
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
    ? `; the line is <span class="n">${fmt(top.line)}</span>${top.book ? ` at ${esc(top.book)}` : ""}` : "";
  return `<b>${esc(top.player)}</b> is predicted to score <span class="n">${
    fmt(top.proj)}</span> points${opp} tonight${line}.`;
}

async function initBoard() {
  const meta = await renderFreshness();
  const data = await loadJSON("data/projections.json");
  let rows = data.rows;
  // L10 from our side's point of view: an under that the player went
  // over in 4 of 10 landed 6 of 10
  rows.forEach(r => {
    r.diff = r.proj == null || r.line == null ? null : +(r.proj - r.line).toFixed(1);
    r.diff_pct = r.diff == null || !r.line ? null : r.diff / r.line;
    r.adiff = r.diff == null ? null : Math.abs(r.diff);
    r.adpct = r.diff_pct == null ? null : Math.abs(r.diff_pct);
    // the side we call on a real edge, else the way our prediction leans
    const lean = r.tier ? r.side : (r.diff == null ? null : r.diff >= 0 ? "over" : "under");
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
      ${predTd(r)}${lineTd(r)}${diffTd(r)}${edgeTd(r)}${muTd(r)}${hitTd(r)}
    </tr>`).join("") || `<tr><td colspan="9" class="empty">No rows match.</td></tr>`;
  };

  [statSel, tierSel, teamSel, gameSel].forEach(el => el.onchange = render);
  q.oninput = render;
  sortable($("#board"), rows, render);
  // default: biggest edge first; rows without a line after, by prediction
  rows.sort((a, b) => cmpBy(boardSort, -1)(a, b) || (b.proj ?? 0) - (a.proj ?? 0));
  render();
}


/* ---------- movement since the morning (brief §5.4) ----------
   "22.4 at 9am → 25.1, Jokic out". The prior is the day's first run;
   times are shown in Australian Eastern time, where the readers are. */
function aedtTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit",
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

function predCell(r, bold) {
  const v = bold ? `<b>${fmt(r.proj)}</b>` : fmt(r.proj);
  if (r.prior == null || r.proj == null) return v;
  const up = r.proj > r.prior;
  const was = `${fmt(r.prior)} at ${aedtTime(r.prior_at)}`;
  return `${v} <span class="mv ${up ? "up" : "down"}" title="${was} → ${
    fmt(r.proj)}, ${esc(r.move_reason || "")}">${up ? "▲" : "▼"}</span>` +
    `<div class="was">was ${was} · ${esc(r.move_reason || "")}</div>`;
}

function renderMovers(data) {
  const el = $("#movers");
  if (!el) return;
  const m = data.movers || [];
  const ups = (data.updates || []).map(u => aedtTime(u.run_at)).filter(Boolean);
  if (!m.length) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<div class="section"><h2>Since this morning</h2></div>
    <p class="sub">Predictions that moved after news. Updated ${
      ups.join(", ")} (AEDT).</p>
    <div class="tablewrap"><table><tbody>${m.map(r => `<tr>
      <td class="s"><a href="player.html?id=${r.player_id}">${esc(r.player)}</a></td>
      <td class="s">${teamBadge(r.team)}</td>
      <td class="s">${r.stat}</td>
      <td class="num dim">${fmt(r.prior)}</td>
      <td class="num">→ <b>${fmt(r.now)}</b></td>
      <td class="num"><span class="mv ${r.delta > 0 ? "up" : "down"}">${
        r.delta > 0 ? "+" : ""}${fmt(r.delta)}</span></td>
      <td class="s">${esc(r.reason)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

/* ---------- prop chart (player hub) ---------- */
const esc = s => String(s).replace(/[&<>"']/g,
  c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function statValue(g, stat) {
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
  // games chronological: [{date, opp, v}] — bars over/under vs the line
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
    const bar = g.v <= 0
      ? `<line x1="${x}" x2="${x + bw}" y1="${base}" y2="${base}"
           stroke="${hue}" stroke-width="2"></line>`
      : `<path d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top}
           H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r}
           V${base} Z" fill="${hue}"></path>`;
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
async function initPlayer() {
  await renderFreshness();
  const idx = await loadJSON("data/player_hub/index.json");
  const label = p => `${p.player} (${p.team})`;
  $("#playerList").innerHTML = idx.map(p =>
    `<option value="${esc(label(p))}"></option>`).join("");
  const want = new URLSearchParams(location.search).get("id");
  const cur = idx.find(p => String(p.player_id) === want) || idx[0];
  const q = $("#playerQ");
  const go = () => {
    const v = q.value.trim().toLowerCase();
    const hit = idx.find(p => label(p).toLowerCase() === v)
      || (v.length > 2 && idx.filter(p => p.player.toLowerCase().includes(v)).length === 1
          && idx.find(p => p.player.toLowerCase().includes(v)));
    if (hit && String(hit.player_id) !== String(cur.player_id))
      location.search = `?id=${hit.player_id}`;
  };
  q.addEventListener("change", go);
  q.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  const pid = cur.player_id;
  const h = await loadJSON(`data/player_hub/${pid}.json`);

  $("#pname").textContent = h.player;
  document.title = `${h.player} props and stats — the tipoff`;
  $("#psinglet").innerHTML = playerSinglet(h.team, h.number);
  const oppAb = h.opp ? teamMeta(h.opp)[0] : null;
  $("#pkicker").innerHTML = `${teamBadge(h.team)} ${esc(h.team || "")}${
    oppAb ? ` · v ${esc(oppAb)} tonight` : ""}${h.minutes
    ? ` · ${fmt(h.minutes.value)} min predicted` : ""}`;

  const S = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TOV"];
  const P = h.projections || {};
  const L = h.lines || {};
  // the page's answer in one sentence (brief section 9)
  if (P.PTS) {
    $("#plead").innerHTML = `<b>${esc(h.player)}</b> is predicted to score <span class="n">${
      fmt(P.PTS.mean)}</span> points${h.opp ? ` against ${esc(h.opp)}` : ""} tonight${
      L.PTS ? `; the line is <span class="n">${fmt(L.PTS.line)}</span>${
        L.PTS.book ? ` at ${esc(L.PTS.book)}` : ""}` : ""}.`;
  }
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
  // tonight's cards: prediction, range, and the line with its edge
  $("#projCards").innerHTML = [...S, ...COMBOS].filter(s => P[s]).map(s => {
    const v = P[s], l = L[s];
    const over = l && l.side === "over";
    const edge = l && l.edge != null
      ? `<span class="edge ${l.tier ? `hot ${l.side}` : "cold"}">${l.tier
          ? `<span class="ar">${over ? "▲" : "▼"}</span>${over ? "O" : "U"} ` : ""}${pct(l.edge)}</span>` : "";
    return `<div class="card" data-stat="${s}"><div class="k">${s}</div>
      <div class="v">${fmt(v.mean)}</div>
      <div class="r">${fmt(v.floor, 0)}–${fmt(v.ceiling, 0)}</div>
      ${l ? `<div class="cl"><span>${fmt(l.line)}${l.price != null
        ? ` <span class="sm">@ ${fmt(l.price, 2)}</span>` : ""}</span>${edge}</div>` : ""}</div>`;
  }).join("");

  /* --- interactive prop chart --- */
  const CHART_STATS = [...S, ...COMBOS];
  const log = h.game_log || [];
  const lines = h.lines || {};
  let stat = lines.PTS ? "PTS" : (Object.keys(lines)[0] || "PTS");
  const COMBO_OF = { PRA: ["PTS", "REB", "AST"], PR: ["PTS", "REB"],
                     PA: ["PTS", "AST"], RA: ["REB", "AST"] };
  const projOf = s => h.projections[s]?.mean ?? (COMBO_OF[s]
    ? COMBO_OF[s].reduce((a, k) => a + (h.projections[k]?.mean || 0), 0)
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
      hitCard("Season", all, line);
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
  const rows = Object.entries(h.splits)
    .filter(([, v]) => v && v.games)
    .map(([k, v]) => `<tr><td class="s">${k}</td>
      <td class="num dim">${v.games}</td><td class="num">${fmt(v.min_pg)}</td>
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
          last = parseInt($("#fLast").value, 10);
    let out = log.filter(g => {
      const home = (g.venue || "").toUpperCase().startsWith("H");
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
    return last ? out.slice(-last) : out;
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
    const SUM = [...S.slice(0, 4), ...COMBOS, ...S.slice(4)];
    const vals = s => games.map(g => statValue(g, s));
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
      row("Per 36", s => totMin > 0 ? (vals(s).reduce((a, b) => a + b, 0) / totMin * 36).toFixed(1) : "—", "dimrow") +
      row("Prediction", s => P[s] ? `<b class="pv">${fmt(P[s].mean)}</b>` : "—", "sep") +
      row("Line", s => `<input class="lineIn" data-s="${s}" type="number" step="0.5" value="${
        lineOf(s) ?? ""}" title="${L[s] ? `book line${L[s].book ? ` (${esc(L[s].book)})` : ""}` : "no book line: type one"}">`, "linerow") +
      row("Over", s => { const v = vals(s), l = lineOf(s);
        return l == null ? "—" : `${v.filter(x => x > l).length}/${v.length}`; }, "dimrow") +
      row("Hit rate", s => { const r = rate(s);
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
    const active = ["#fLoc", "#fRole", "#fRest", "#fResult", "#fTier", "#fOpp"]
      .filter(sel => $(sel).value !== "all").length
      + (($("#fMinLo").value || $("#fMinHi").value) ? 1 : 0);
    $("#fCount").textContent = active ? `· ${active} on` : "";

    $("#gamelog tbody").innerHTML = games.slice().reverse().map(g => `<tr>
      <td class="s">${g.game
        ? `<a href="boxscore.html?g=${encodeURIComponent(g.game)}"
             target="_blank" rel="noopener" title="open box score">${g.date} ↗</a>`
        : `<span class="dim">${g.date}</span>`}</td>
      <td class="s">${teamBadge(g.opp)}${g.opp_tier
        ? ` <span class="dim" title="opponent standing">(${esc(g.opp_tier)})</span>` : ""}</td>
      <td class="s dim">${(g.venue || "").toUpperCase().startsWith("H") ? "H" : "A"}</td>
      <td class="s ${g.result === "W" ? "pos" : g.result === "L" ? "neg" : "dim"}">${g.result || "—"}</td>
      <td class="s">${g.starter
        ? '<span class="badge src">start</span>' : '<span class="dim">bench</span>'}</td>
      <td class="num">${fmt(g.min)}</td>
      ${S.map(s => `<td class="num">${fmt(g[s], 0)}</td>`).join("")}
      <td class="num dim">${fmt(statValue(g, "PRA"), 0)}</td>
    </tr>`).join("")
      || `<tr><td colspan="14" class="empty">No games match these filters.</td></tr>`;
    redraw();
  };

  if (matchMedia("(max-width: 900px)").matches) $("#filterBox").open = false;
  ["#fLast", "#fLoc", "#fRole", "#fRest", "#fOpp", "#fResult",
   "#fTier"].forEach(sel => $(sel).onchange = renderLog);
  ["#fMinLo", "#fMinHi"].forEach(sel => $(sel).oninput = renderLog);
  $("#fReset").onclick = () => {
    $("#fLast").value = "20"; $("#fLoc").value = "all";
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
  const S = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TOV"];
  const index = await loadJSON("data/teams/index.json");
  const teamSel = $("#wTeam"), playerSel = $("#wPlayer");
  teamSel.innerHTML = index.map(t =>
    `<option value="${esc(t.slug)}">${esc(t.team)}</option>`).join("");

  let team = null;                 // loaded team payload
  let focal = null;                // focal player id (string)
  const state = new Map();         // mate id -> "in" | "out"

  const avg = (games, pick) => {
    if (!games.length) return null;
    return games.reduce((a, g) => a + pick(g), 0) / games.length;
  };

  const focalLine = g => g.lines[focal];
  const played = (g, id) => g.lines[id] !== undefined;

  const matching = () => team.games.filter(g => {
    if (!focalLine(g)) return false;           // focal must have played
    for (const [id, mode] of state) {
      if (mode === "in" && !played(g, id)) return false;
      if (mode === "out" && played(g, id)) return false;
    }
    return true;
  });

  const rowFor = (label, games) => {
    if (!games.length)
      return `<tr><td class="s">${label}</td><td class="num dim">0</td>
        <td colspan="8" class="empty">no games</td></tr>`;
    const cells = [["min", g => focalLine(g).min]]
      .concat(S.map(s => [s, g => focalLine(g)[s]]));
    return `<tr><td class="s"><b>${label}</b></td>
      <td class="num dim">${games.length}</td>
      ${cells.map(([, pick]) =>
        `<td class="num">${avg(games, pick).toFixed(1)}</td>`).join("")}
    </tr>`;
  };

  const diffRow = (a, b) => {
    if (!a.length || !b.length) return "";
    const cells = [["min", g => focalLine(g).min]]
      .concat(S.map(s => [s, g => focalLine(g)[s]]));
    return `<tr><td class="s">Diff</td><td class="num dim">—</td>
      ${cells.map(([, pick]) => {
        const d = avg(b, pick) - avg(a, pick);
        return `<td class="num ${d > 0 ? "pos" : d < 0 ? "neg" : "dim"}">${
          (d > 0 ? "+" : "") + d.toFixed(1)}</td>`;
      }).join("")}</tr>`;
  };

  const renderMates = () => {
    $("#wMates").innerHTML = team.players
      .filter(p => String(p.id) !== focal)
      .map(p => {
        const mode = state.get(String(p.id));
        const cls = mode === "in" ? "chip on" : mode === "out" ? "chip on" : "chip";
        const tag = mode === "in" ? " ✓IN" : mode === "out" ? " ✗OUT" : "";
        const style = mode === "in"
          ? 'style="background:var(--over);border-color:var(--over);color:#fff"'
          : mode === "out"
          ? 'style="background:var(--under);border-color:var(--under);color:#fff"'
          : "";
        return `<button class="${cls}" ${style} data-id="${p.id}"
          title="${p.games} games, median ${p.med_min} min">${esc(p.name)}${tag}</button>`;
      }).join("");
  };

  const render = () => {
    renderMates();
    const all = team.games.filter(focalLine);
    const sel = matching();
    const anyFilter = state.size > 0;
    $("#wCompare tbody").innerHTML =
      rowFor("Season (all games)", all)
      + (anyFilter ? rowFor("Matching lineup", sel) : "")
      + (anyFilter ? diffRow(all, sel) : "");
    const ins = [...state].filter(([, m]) => m === "in").length;
    const outs = [...state].filter(([, m]) => m === "out").length;
    $("#wNote").textContent = anyFilter
      ? `${sel.length} of ${all.length} games match (${ins} in, ${outs} out).`
        + (sel.length < 5 ? " Small sample — read with caution." : "")
      : "Pick teammates above to split the season.";
    $("#wLog tbody").innerHTML = sel.slice().reverse().map(g => {
      const l = focalLine(g);
      return `<tr>
        <td class="s">${g.game
          ? `<a href="boxscore.html?g=${encodeURIComponent(g.game)}"
               target="_blank" rel="noopener">${g.date} ↗</a>`
          : `<span class="dim">${g.date}</span>`}</td>
        <td class="s">${teamBadge(g.opp)}</td>
        <td class="s dim">${(g.venue || "").toUpperCase().startsWith("H") ? "H" : "A"}</td>
        <td class="num">${fmt(l.min)}</td>
        ${S.map(s => `<td class="num">${fmt(l[s], 0)}</td>`).join("")}
      </tr>`;
    }).join("") || `<tr><td colspan="11" class="empty">No games match.</td></tr>`;
  };

  const loadTeam = async slug => {
    team = await loadJSON(`data/teams/${slug}.json`);
    state.clear();
    playerSel.innerHTML = team.players.map(p =>
      `<option value="${p.id}">${esc(p.name)} — ${p.med_min} min</option>`).join("");
    focal = playerSel.value;
    render();
  };

  $("#wMates").onclick = e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    const id = b.dataset.id, cur = state.get(id);
    if (!cur) state.set(id, "in");
    else if (cur === "in") state.set(id, "out");
    else state.delete(id);
    render();
  };
  teamSel.onchange = () => loadTeam(teamSel.value);
  playerSel.onchange = () => { focal = playerSel.value; state.clear(); render(); };
  $("#wReset").onclick = () => { state.clear(); render(); };
  await loadTeam(teamSel.value);
}

/* ---------- matchups page ---------- */
async function initMatchups() {
  await renderFreshness();
  const data = await loadJSON("data/matchups.json");
  const S = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TOV"];
  const ORDER = ["PG", "SG", "SF", "PF", "C", "G", "F"];
  const positions = [...new Set(
    Object.values(data.windows).flat().map(r => r.pos))]
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  let pos = positions[0];
  const winSel = $("#winSel");
  [...winSel.options].forEach(o => { if (!data.windows[o.value]) o.remove(); });
  if (!winSel.options.length) throw new Error("no matchup windows");
  if (data.coverage != null) {
    const note = document.createElement("p");
    note.className = "sub";
    note.innerHTML = `Built from our own box scores. Positions are each
      player's usual spot (PG/SG/SF/PF/C) from roster listings and ESPN depth
      charts, covering <b>${(data.coverage * 100).toFixed(0)}%</b> of minutes
      played; players without one are left out rather than guessed.`;
    $("#posChips").parentElement.after(note);
  }
  $("#posChips").innerHTML = positions.map(p =>
    `<button class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join("");

  let rows = [], sortK = "PTS", sortDir = -1;
  const cell = v => v == null ? `<td class="num dim">—</td>`
    : `<td class="num ${v > 0.03 ? "pos" : v < -0.03 ? "neg" : ""}">
         ${(v > 0 ? "+" : "") + (v * 100).toFixed(0)}%</td>`;
  const render = () => {
    $$(".chip", $("#posChips")).forEach(c =>
      c.classList.toggle("on", c.dataset.p === pos));
    rows = data.windows[$("#winSel").value]
      .filter(r => r.pos === pos)
      .sort((a, b) => {
        const x = a[sortK], y = b[sortK];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * -sortDir;
      });
    $("#mx tbody").innerHTML = rows.map(r => `<tr>
      <td class="s">${teamBadge(r.team, {withName: true})}</td>
      <td class="num dim">${r.minutes ?? "—"}</td>
      ${S.map(s => cell(r[s])).join("")}
    </tr>`).join("") ||
      `<tr><td colspan="9" class="empty">No teams meet the sample floor
       in this window.</td></tr>`;
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
  document.title = `${d.matchup} ${d.date} — the tipoff`;
  $("#bsTables").innerHTML = Object.entries(d.teams).map(([team, t]) => `
    <div class="section"><h2>${teamBadge(team)} ${esc(team)}</h2></div>
    <div class="tablewrap"><table>
      <thead><tr><th class="s">Player</th><th>Min</th>
        ${S.map(s => `<th>${s}</th>`).join("")}</tr></thead>
      <tbody>
        ${t.players.map(p => `<tr>
          <td class="s"><a href="player.html?id=${p.player_id}">
            ${esc(p.player)}</a>${p.starter
              ? ' <span class="badge src">start</span>' : ""}</td>
          <td class="num">${fmt(p.min)}</td>
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
    : `The track record starts on opening night (21 October AEDT). From then, every prediction is graded here the morning after, in the open.`;
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
  const t = d.tips;
  $("#rtip").innerHTML = `
    <div class="card"><div class="k">Avg CLV</div><div class="v">${pct(t?.avg_clv)}</div><div class="r">${t?.n_clv ?? 0} graded at the close</div></div>
    <div class="card"><div class="k">Beat the close</div><div class="v">${pct(t?.beat_close)}</div></div>
    <div class="card"><div class="k">Won–lost</div><div class="v">${t ? `${t.wins}–${t.losses}` : "0–0"}</div><div class="r"><a href="tip.html">Every tip →</a></div></div>`;
  const e = d.edges || {};
  $("#redges").innerHTML = `
    <div class="card"><div class="k">Avg CLV</div><div class="v">${pct(e.avg_clv)}</div><div class="r">${e.n_clv ?? 0} graded at the close</div></div>
    <div class="card"><div class="k">Beat the close</div><div class="v">${pct(e.beat_close)}</div></div>
    <div class="card"><div class="k">Edges flagged</div><div class="v">${(e.n ?? 0).toLocaleString("en-AU")}</div></div>`;
}

/* ---------- Just the Tip ---------- */
function auDay(isoDate) {
  const d = new Date(isoDate + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "short",
    day: "numeric", month: "short" }).format(d).replace(",", "");
}
const sideWord = s => s === "over" ? "Over" : "Under";
const sideGlyph = s => s === "over" ? "▲O" : "▼U";

function tipBet(t) {
  return `${t.market_label} ${sideWord(t.side)} <b>${fmt(t.line)}</b> @ `
    + `<b>${fmt(t.price, 2)}</b>, ${t.book_label}`;
}

async function initTip() {
  await renderFreshness();
  const d = await loadJSON("data/tips.json");
  const t = d.today;
  const day = auDay(d.au_game_date);
  if (t) {
    const game = [t.team, t.opp].filter(Boolean).join(" v ");
    $("#tlead").innerHTML = `Our biggest edge for ${day} is <b>${t.player}</b> `
      + `${sideWord(t.side).toLowerCase()} ${fmt(t.line)} ${t.market_label.toLowerCase()} `
      + `at ${fmt(t.price, 2)} with ${t.book_label}; we predict `
      + `<span class="n">${fmt(t.model_proj)}</span>.`;
    const closed = t.closing_price != null
      ? `Closed ${fmt(t.closing_line)} @ ${fmt(t.closing_price, 2)} · CLV ${pct(t.clv)}` : "";
    const res = t.result ? ` · ${t.result}${t.actual != null ? ` (${fmt(t.actual)})` : ""}` : "";
    $("#tcard").innerHTML = `<div class="tipcard">
      <div class="ctx">${day.toUpperCase()}${t.trial ? `<span class="tag trial">Preseason trial</span>` : ""}</div>
      <div class="who">${t.player}</div>
      <div class="ctx">${game}${t.game_start ? ` · tips off ${whenAEDT(t.game_start).split(",")[0]}` : ""}</div>
      <div class="bet">${tipBet(t)}</div>
      <div class="figs">
        <div class="fig"><div class="k">Our prediction</div><div class="v ours">${fmt(t.model_proj)}</div></div>
        <div class="fig"><div class="k">Book line</div><div class="v">${fmt(t.line)}</div></div>
        <div class="fig"><div class="k">Edge ${sideGlyph(t.side)}</div><div class="v ${t.side}">${pct(t.edge)}</div></div>
      </div>
      <div class="foot">Posted ${t.posted_at ? whenAEDT(t.posted_at) : ""}${t.au_book ? "" : " · US line: Australian books aren't pricing NBA player props yet"}${closed ? " · " + closed : ""}${res}</div>
    </div>`;
  } else {
    $("#tlead").textContent = `No tip is posted for ${day} yet. It goes up around `
      + `8pm Sydney time the night before the games, once the bookmakers' `
      + `player lines are up; if none clears the rules, there's no tip.`;
  }

  const s = d.summary;
  $("#tnote").textContent = s.n_tips
    ? `Regular-season tips only; preseason trial tips are listed below but not counted.`
    : `The record starts on opening night, 21 October (AEDT). Preseason tips are a trial run: listed, never counted.`;
  $("#tcards").innerHTML = `
    <div class="card"><div class="k">Avg CLV</div><div class="v">${pct(s.avg_clv)}</div><div class="r">${s.n_clv} graded at the close</div></div>
    <div class="card"><div class="k">Beat the close</div><div class="v">${pct(s.beat_close)}</div></div>
    <div class="card"><div class="k">Won–lost</div><div class="v">${s.wins}–${s.losses}</div><div class="r">${s.pushes} push · ${s.voids} void</div></div>
    <div class="card"><div class="k">Hit rate</div><div class="v">${pct(s.hit_rate)}</div></div>
    <div class="card"><div class="k">Return (flat)</div><div class="v">${pct(s.roi)}</div></div>`;
  const tb = $("#tips tbody");
  tb.innerHTML = d.tips.length ? d.tips.map(r => `<tr class="${r.trial ? "trial" : ""}">
      <td class="s dim">${auDay(dayAfter(r.slate_date))}${r.trial ? " · trial" : ""}</td>
      <td class="s">${r.player}</td>
      <td class="s">${r.market_label} ${sideGlyph(r.side)} ${fmt(r.line)}</td>
      <td class="num opt">${fmt(r.price, 2)}</td>
      <td class="num opt">${r.closing_price != null ? (r.closing_line !== r.line ? fmt(r.closing_line) + " @ " : "") + fmt(r.closing_price, 2) : "—"}</td>
      <td class="num ${r.clv > 0 ? "pos" : r.clv < 0 ? "neg" : ""}">${pct(r.clv)}</td>
      <td class="num">${r.result ?? "—"}</td>
    </tr>`).join("")
    : `<tr><td colspan="7" class="empty">No tips yet. The first goes up the
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
  const [tips, board, gd] = await Promise.all([
    loadJSON("data/tips.json").catch(() => null),
    loadJSON("data/projections.json").catch(() => null),
    loadJSON("data/games.json").catch(() => null)]);
  const games = gd?.games || [];
  if (games.length && games[0].start) $("#hday").textContent = `Tonight · ${auDate(games[0].start)}`;

  const t = tips?.today;
  const rec = tips?.summary;
  $("#hTip").innerHTML = `<div class="ph2"><span>Just the Tip</span><a href="tip.html">Record →</a></div>` + (t
    ? `<div class="tipmini">
        <div class="who">${esc(t.player)}</div>
        <div class="bet">${esc(t.market_label)} ${t.side === "over" ? "Over" : "Under"} <b>${fmt(t.line)}</b> @ <b>${fmt(t.price, 2)}</b>, ${esc(t.book_label)}</div>
        <div class="sm">Our prediction <b class="ours">${fmt(t.model_proj)}</b> · edge ${edgeSpan(t)}${t.trial ? ` · <span class="tag trial">Preseason trial</span>` : ""}</div>
      </div>`
    : `<p class="dim">Our biggest edge goes up around 8pm Sydney time the night before the games.</p>`)
    + (rec && rec.n_tips ? `<div class="sm dim">Season: ${rec.wins}–${rec.losses}, average CLV ${pct(rec.avg_clv)}</div>` : "");

  const rows = (board?.rows || []).filter(r => r.edge != null && r.line != null && r.tier)
    .sort((a, b) => b.edge - a.edge).slice(0, 6);
  $("#hEdges").innerHTML = `<div class="ph2"><span>Biggest edges tonight</span><a href="predictions.html">All predictions →</a></div>` + (rows.length
    ? `<table class="mini"><tbody>${rows.map(r => `<tr>
        <td class="s"><a href="player.html?id=${r.player_id}">${esc(r.player)}</a> <span class="sm dim">${esc(STAT_WORD[r.stat] || r.stat)}</span></td>
        <td class="num"><span class="ours">${fmt(r.proj)}</span> <span class="dim">v ${fmt(r.line)}</span></td>
        <td class="num">${edgeSpan(r)}</td></tr>`).join("")}</tbody></table>`
    : `<p class="dim">Edges appear once the bookmakers post tonight's player lines.</p>`);

  $("#hGames").innerHTML = games.length ? games.map(g => {
    const fav = g.p_home == null ? null : g.p_home >= 0.5 ? [g.home, g.p_home] : [g.away, 1 - g.p_home];
    return `<a class="gmini" href="games.html#g${esc(g.event_id)}">
      <div class="t">${g.start ? aedtTime(g.start) : ""}</div>
      <div class="m">${teamBadge(g.away)} <span class="dim">@</span> ${teamBadge(g.home)}</div>
      <div class="sm">${favLine(g, g.line_home)} · ${fmt(g.total)}</div>
      ${fav ? `<div class="sm dim">${code(fav[0])} ${pct(fav[1]).replace(".0%", "%")} to win</div>` : ""}
    </a>`; }).join("")
    : `<p class="dim">No games tonight.</p>`;
}

/* ---------- game predictions ---------- */
async function initGames() {
  await renderFreshness();
  const d = await loadJSON("data/games.json");
  const games = d.games || [];
  if (games.length && games[0].start) $("#gday").textContent = auDate(games[0].start);
  if (!games.length) {
    $("#glead").textContent = "No NBA games tonight.";
    return;
  }
  // answer first: the game where we differ most from the bookmakers
  const gap = g => (g.line_home != null && g.book_line_home != null) ? Math.abs(g.line_home - g.book_line_home) : -1;
  const top = [...games].sort((a, b) => gap(b) - gap(a))[0];
  const winner = top.pred_home >= top.pred_away ? [top.home, top.away, top.pred_home, top.pred_away]
                                                 : [top.away, top.home, top.pred_away, top.pred_home];
  $("#glead").innerHTML = `We predict ${esc(winner[0])} to beat ${esc(winner[1])} `
    + `<span class="n">${fmt(winner[2], 0)}–${fmt(winner[3], 0)}</span>`
    + (top.book_line_home != null ? `; the bookmakers have ${favLine(top, top.book_line_home)}, `
      + `we have ${favLine(top, top.line_home)}.` : ".")
    + ` ${games.length} game${games.length > 1 ? "s" : ""} tonight.`;

  $("#games").innerHTML = games.map(g => {
    const sd = (g.line_home != null && g.book_line_home != null) ? g.line_home - g.book_line_home : null;
    const td = (g.total != null && g.book_total != null) ? g.total - g.book_total : null;
    const win = p => p == null ? "—" : pct(p).replace(".0%", "%");
    return `<article class="game" id="g${esc(g.event_id)}">
      <header><span class="t">${g.start ? whenAEDT(g.start) : ""}</span></header>
      <div class="score">
        <div class="side">${teamBadge(g.away)} <span class="nm">${esc(g.away)}</span><b class="ours">${fmt(g.pred_away, 0)}</b></div>
        <div class="side">${teamBadge(g.home)} <span class="nm">${esc(g.home)}</span><b class="ours">${fmt(g.pred_home, 0)}</b></div>
      </div>
      <table class="gt"><thead><tr><th class="s"></th><th>Ours</th><th>Bookmakers</th><th>Gap</th></tr></thead><tbody>
        <tr><td class="s">Spread</td><td class="num ours">${favLine(g, g.line_home)}</td>
          <td class="num">${favLine(g, g.book_line_home)}</td>
          <td class="num ${sd != null && Math.abs(sd) >= 2 ? "gap" : "dim"}">${sd == null ? "—" : fmt(Math.abs(sd)) + " pts"}</td></tr>
        <tr><td class="s">Total</td><td class="num ours">${fmt(g.total)}<div class="sm dim">${fmt(g.total_lo, 0)}–${fmt(g.total_hi, 0)}</div></td>
          <td class="num">${fmt(g.book_total)}</td>
          <td class="num ${td != null && Math.abs(td) >= 3 ? "gap" : "dim"}">${td == null ? "—" : signed(td)}</td></tr>
        <tr><td class="s">${code(g.home)} to win</td><td class="num ours">${win(g.p_home)}</td>
          <td class="num">${win(g.book_p_home)}</td><td class="num dim"></td></tr>
      </tbody></table>
    </article>`; }).join("");

  // SportsEvent markup, one per game (brief §9)
  const ld = games.filter(g => g.start).map(g => ({
    "@context": "https://schema.org", "@type": "SportsEvent",
    name: `${g.away} at ${g.home}`, startDate: g.start, sport: "Basketball",
    homeTeam: { "@type": "SportsTeam", name: g.home },
    awayTeam: { "@type": "SportsTeam", name: g.away },
    description: `Prediction: ${g.home} ${fmt(g.pred_home, 0)}, ${g.away} ${fmt(g.pred_away, 0)}; total ${fmt(g.total)}.`,
  }));
  const s = document.createElement("script");
  s.type = "application/ld+json"; s.textContent = JSON.stringify(ld);
  document.head.appendChild(s);
}

/* ---------- schedule (AEDT) ---------- */
async function initSchedule() {
  await renderFreshness();
  const d = await loadJSON("data/games.json");
  const games = d.games || [];
  if (!games.length) { $("#sclead").textContent = "No NBA games today."; return; }
  const first = games.find(g => g.start);
  $("#sclead").innerHTML = `There ${games.length === 1 ? "is 1 NBA game" : `are ${games.length} NBA games`} today`
    + (first ? ` (${auDate(first.start)}); the first tips off at <b>${whenAEDT(first.start).split(",")[0]}</b>.` : ".");
  $("#sched tbody").innerHTML = games.map(g => {
    const hw = g.pred_home != null && g.pred_home >= g.pred_away;
    return `<tr>
      <td class="s">${g.start ? whenAEDT(g.start).split(",")[0] : "—"}</td>
      <td class="s"><a href="games.html#g${esc(g.event_id)}">${teamBadge(g.away)} <span class="tn">${esc(g.away)}</span> <span class="dim">@</span> ${teamBadge(g.home)} <span class="tn">${esc(g.home)}</span></a></td>
      <td class="s">${g.pred_home == null ? "—" : `${esc(code(hw ? g.home : g.away))} by ${fmt(Math.abs(g.pred_home - g.pred_away), 0)}`}</td>
      <td class="num">${fmt(g.total)}</td></tr>`; }).join("");
}

/* ---------- situational splits ---------- */
const SPLIT_FILTERS = [
  { k: "venue", label: "Venue", opts: [["all", "All"], ["home", "Home"], ["away", "Away"]],
    f: (r, v) => v === "all" || (v === "home") === r.home },
  { k: "b2b", label: "Back-to-back", opts: [["all", "All"], ["team", "Team on B2B"], ["opp", "Opponent on B2B"], ["either", "Either"], ["neither", "Neither"]],
    f: (r, v) => { const t = r.rest === 0, o = r.opp_rest === 0;
      return v === "all" || (v === "team" ? t : v === "opp" ? o : v === "either" ? (t || o) : (!t && !o)); } },
  { k: "rest", label: "Rest days", opts: [["all", "All"], ["0", "0"], ["1", "1"], ["2", "2+"]],
    f: (r, v) => v === "all" || (r.rest != null && (v === "2" ? r.rest >= 2 : r.rest === +v)) },
  { k: "role", label: "Favourite", opts: [["all", "All"], ["fav", "Favourite"], ["dog", "Underdog"]],
    f: (r, v) => v === "all" || (r.spread != null && (v === "fav" ? r.spread < 0 : r.spread > 0)) },
  { k: "band", label: "Spread", opts: [["all", "All"], ["s", "0–3"], ["m", "3.5–7"], ["l", "7.5+"]],
    f: (r, v) => { if (v === "all") return true; if (r.spread == null) return false;
      const a = Math.abs(r.spread); return v === "s" ? a <= 3 : v === "m" ? a > 3 && a <= 7 : a > 7; } },
  { k: "total", label: "Total", opts: [["all", "All"], ["lo", "Under 220"], ["mid", "220–234.5"], ["hi", "235+"]],
    f: (r, v) => { if (v === "all") return true; if (r.total == null) return false;
      return v === "lo" ? r.total < 220 : v === "mid" ? r.total >= 220 && r.total < 235 : r.total >= 235; } },
  { k: "top3", label: "Top-3 minutes player", opts: [["all", "All"], ["out", "One missing"], ["in", "All playing"]],
    f: (r, v) => v === "all" || (v === "out") === !!r.missing_top3 },
];

/* Team rows (each game appears once per side). O–U is counted per game,
   so a game is never counted twice. */
const gameKey = r => r.date + "|" + (r.home ? r.team : r.opp);
function splitStats(rows) {
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

async function initSplits() {
  await renderFreshness();
  const d = await loadJSON("data/splits.json");
  const all = d.rows || [];
  const state = Object.fromEntries(SPLIT_FILTERS.map(f => [f.k, "all"]));
  const months = [...new Set(all.map(r => r.month))].sort();
  const filters = [...SPLIT_FILTERS, { k: "month", label: "Month",
    opts: [["all", "All"], ...months.map(m => [m, new Date(m + "-01T00:00:00Z").toLocaleString("en-AU", { month: "short", timeZone: "UTC" })])],
    f: (r, v) => v === "all" || r.month === v }];
  state.month = "all";
  $("#sfilters").innerHTML = filters.map(f => `<label class="fsel"><span>${f.label}</span>
    <select data-k="${f.k}">${f.opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>`).join("");

  let sortKey = "ats_pct", sortDir = -1;
  function render() {
    const rows = all.filter(r => filters.every(f => f.f(r, state[f.k])));
    const on = filters.filter(f => state[f.k] !== "all").map(f => f.opts.find(o => o[0] === state[f.k])[1].toLowerCase());
    // unfiltered, every game counts once per side and ATS is 50% by
    // construction: the headline reads from the home side instead
    const who = on.length ? rows : rows.filter(r => r.home);
    const s = splitStats(who);
    const ou = splitStats(rows);
    const subject = on.length ? `Teams (${esc(on.join(", "))})` : "Home teams";
    $("#slead").innerHTML = !all.length
      ? `The 2026-27 splits start on opening night (21 October AEDT) and fill in game by game.`
      : `${subject} are <b>${s.aw}–${s.al}${s.ap ? `–${s.ap}` : ""}</b> against the spread this season; `
        + `these games have gone <b>${ou.o}–${ou.u}</b> over/under (${ou.games} games).`;
    $("#scards").innerHTML = `
      <div class="card"><div class="k">Games</div><div class="v">${ou.games}</div><div class="r">${s.n} team results</div></div>
      <div class="card"><div class="k">ATS${on.length ? "" : ", home"}</div><div class="v">${s.aw}–${s.al}</div><div class="r">${pct(s.ats_pct)} · ${s.ap} push</div></div>
      <div class="card"><div class="k">Over–under</div><div class="v">${ou.o}–${ou.u}</div><div class="r">${pct(ou.ov_pct)} overs</div></div>
      <div class="card"><div class="k">Straight up${on.length ? "" : ", home"}</div><div class="v">${s.w}–${s.l}</div></div>
      <div class="card"><div class="k">Vs spread${on.length ? "" : ", home"}</div><div class="v">${signed(s.mvs)}</div><div class="r">avg pts</div></div>`;
    const by = {};
    rows.forEach(r => (by[r.team] = by[r.team] || []).push(r));
    let teams = Object.entries(by).map(([team, rs]) => ({ team, ...splitStats(rs) }));
    const small = $("#small").checked;
    const hidden = teams.filter(t => t.n < 10).length;
    if (!small) teams = teams.filter(t => t.n >= 10);
    teams.sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      if (x == null) return 1; if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
    });
    $("#splits tbody").innerHTML = teams.length ? teams.map(t => `<tr class="${t.n < 10 ? "thin" : ""}">
      <td class="s">${teamBadge(t.team)} <span class="tn">${esc(t.team)}</span></td>
      <td class="num">${t.n}</td>
      <td class="num">${t.w}–${t.l}</td>
      <td class="num">${t.aw}–${t.al}${t.ap ? `–${t.ap}` : ""}<div class="sm dim">${pct(t.ats_pct)}</div></td>
      <td class="num opt">${t.o}–${t.u}${t.p ? `–${t.p}` : ""}<div class="sm dim">${pct(t.ov_pct)}</div></td>
      <td class="num ${t.mvs > 0 ? "pos" : ""}">${signed(t.mvs)}</td></tr>`).join("")
      : `<tr><td colspan="6" class="empty">${all.length
        ? `No team has 10 games in this split yet${hidden ? ` (${hidden} with fewer: tick the box above to see them)` : ""}.`
        : "No games yet this season."}</td></tr>`;
    $("#small").parentElement.lastChild.textContent = ` Show teams with fewer than 10 games${hidden && !small ? ` (${hidden} hidden)` : ""}`;
  }
  $("#sfilters").addEventListener("change", e => { state[e.target.dataset.k] = e.target.value; render(); });
  $("#small").addEventListener("change", render);
  $$("#splits th[data-k]").forEach(th => th.addEventListener("click", () => {
    const k = { w: "w", ats_pct: "ats_pct", ov_pct: "ov_pct", mvs: "mvs", n: "n", team: "team" }[th.dataset.k];
    sortDir = sortKey === k ? -sortDir : (k === "team" ? 1 : -1); sortKey = k; render();
  }));
  render();
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
    <div class="su-copy"><b>Founding members lock in a lower price.</b>
      <span>Leave your email and we'll tell you when memberships open. One email, nothing else.</span></div>
    <form id="suForm" novalidate>
      <label class="vh" for="suEmail">Email address</label>
      <input id="suEmail" type="email" autocomplete="email" placeholder="you@example.com" required>
      <input id="suWebsite" class="vh" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button id="suBtn" type="submit">Sign up</button>
    </form>
    <p class="su-msg" id="suMsg" role="status"></p>
    <p class="su-fine">Used only to tell you when memberships open. <a href="/privacy.html">Privacy</a></p>`;
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
  const boot = { board: initBoard, player: initPlayer,
                 wow: initWow, record: initRecord, tip: initTip,
                 home: initHome, games: initGames, schedule: initSchedule,
                 splits: initSplits,
                 matchups: initMatchups, boxscore: initBoxscore }[page];
  if (boot) boot().catch(e => {
    console.error(e);
    const m = $("main");
    if (m) m.innerHTML = `<div class="empty">This page's numbers aren't
      published yet. The morning run publishes them here.</div>`;
  });
});
