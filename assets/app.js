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
      const cur = document.documentElement.dataset.theme
        || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
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
    return `These are the numbers from <b>${lastGood}</b>. Tonight's run `
      + `did not complete, so nothing here has been updated since.`;
  }
  // Demo data is already labelled as a replay, so its age isn't news.
  if (m.demo) return null;
  const age = (Date.now() - Date.parse(m.computed_at)) / 3.6e6;
  if (Number.isFinite(age) && age > STALE_HOURS) {
    const ago = age > 48 ? `${Math.floor(age / 24)} days` : `${Math.floor(age)} hours`;
    return `These numbers were computed <b>${ago} ago</b> `
      + `(${m.computed_at}) and have not refreshed since.`;
  }
  return null;
}

async function renderFreshness() {
  try {
    const m = await loadJSON("data/meta.json");
    const el = $("#fresh");
    if (!el) return m;
    const build = { late: "late refresh (near lock)",
                    recalc: "updated after news" }[m.build] || "overnight main build";
    const warn = staleNotice(m);
    el.classList.toggle("stale", !!warn);
    el.innerHTML =
      (warn ? `<div class="staleline"><b>Out of date.</b> ${warn}</div>` : "") +
      `Slate <b>${m.slate_date}</b> · ${build} · computed <b>${m.computed_at}</b>` +
      (m.lines_region === "us"
        ? ` · lines from <b>US bookmakers</b> <span class="dim">(Australian books aren't pricing NBA player props yet)</span>`
        : m.lines_region === "au" ? ` · lines from <b>Australian bookmakers</b>` : "") +
      ` · <span class="dim">${m.model_version}</span>` +
      (m.demo ? ` · <span class="demo">DEMO — 25-26 replay, not live</span>` : "");
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
const BOARD_STATS = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TOV"];
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

/* columns: [key, label, leftAligned, title] */
const LEADER_COLS = [
  ["rank", "Rk", true, "rank for this stat across the whole slate"],
  ["player", "Player", true, ""], ["team", "Team", true, ""],
  ["proj", "Pred", false, "our prediction"], ["floor", "Floor–Ceil", false, "sorts on floor"],
  ["minutes", "Min", false, ""], ["line", "Line", false, ""],
  ["side", "Side", true, ""], ["edge", "Edge", false, ""],
  ["l10_over", "L10", false, "over-rate vs the line, last 10 games"],
];

function leaderTable(stat, rows) {
  // the ACTIVE SORT COLUMN picks the population: default = the 15
  // biggest projections, sort by Edge = the 15 biggest edges on the
  // slate, etc. Nulls sort last, so rows with no line never occupy a
  // slot in an edge-ranked table.
  const s = leaderSort[stat] || { k: "proj", dir: -1 };
  const top = rows.filter(r => r.stat === stat)
    .sort(cmpBy(s.k, s.dir)).slice(0, TOP_N);
  if (!top.length) return "";
  const sortedBy = LEADER_COLS.find(c => c[0] === s.k);
  const byLabel = s.k === "proj" ? "" : ` by ${sortedBy ? sortedBy[1] : s.k}`;
  const head = LEADER_COLS.map(([k, label, left, title]) =>
    `<th class="${left ? "s" : ""}${k === s.k ? " sorted" : ""}"
        data-k="${k}"${title ? ` title="${title}"` : ""}>${label}${
      k === s.k ? (s.dir === -1 ? " ▾" : " ▴") : ""}</th>`).join("");
  return `<div class="section"><h2>${stat} — top ${TOP_N}${byLabel}${
      byLabel && s.dir === 1 ? " (lowest)" : ""}</h2></div>
    <div class="tablewrap"><table data-stat="${stat}">
      <thead><tr>${head}</tr></thead>
      <tbody>${top.map((r, i) => `<tr>
        <td class="s dim">${r.rank ?? i + 1}</td>
        <td class="s"><a href="player.html?id=${r.player_id}">${esc(r.player)}</a>${wwNote(r)}</td>
        <td class="s">${teamBadge(r.team)}</td>
        <td class="num">${predCell(r, true)}</td>
        <td class="num dim">${fmt(r.floor)}–${fmt(r.ceiling)}</td>
        <td class="num">${fmt(r.minutes)}</td>
        <td class="num">${fmt(r.line)}</td>
        <td class="s">${r.side ? `<span class="badge ${r.side}">${r.side}</span>` : "—"}</td>
        <td class="num ${r.edge > 0 ? "pos" : ""}">${pct(r.edge)}</td>
        <td class="num ${r.l10_over > 0.5 ? "pos" : r.l10_over != null && r.l10_over < 0.5 ? "neg" : "dim"}">${
          r.l10_over == null ? "—" : (r.l10_over * 100).toFixed(0) + "%"}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;
}

async function initBoard() {
  await renderFreshness();
  const data = await loadJSON("data/projections.json");
  let rows = data.rows;
  renderMovers(data);
  const tbody = $("#board tbody");
  const statSel = $("#fStat"), tierSel = $("#fTier"),
        teamSel = $("#fTeam"), gameSel = $("#fGame"), q = $("#fQ");
  [...new Set(rows.map(r => r.team).filter(Boolean))].sort().forEach(t => {
    const o = document.createElement("option");
    o.value = o.textContent = t;
    teamSel.append(o);
  });
  [...new Set(rows.map(r => r.game).filter(Boolean))].sort().forEach(g => {
    const o = document.createElement("option");
    o.value = o.textContent = g;
    gameSel.append(o);
  });

  // leader tables sort independently, per stat
  $("#leaders").onclick = e => {
    const th = e.target.closest("th[data-k]");
    if (!th) return;
    const stat = th.closest("table").dataset.stat;
    const cur = leaderSort[stat] || { k: "proj", dir: -1 };
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
    $("#leaders").hidden = view !== "leaders";
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
      $("#leaders").innerHTML = BOARD_STATS.map(s => leaderTable(s, base))
        .join("") || `<div class="empty">No players match.</div>`;
      return;
    }
    const s = statSel.value, t = tierSel.value;
    const view_ = base.filter(r =>
      (s === "all" || r.stat === s) &&
      (t === "all" || (t === "gated" ? r.tier : r.tier === t)));
    renderFull(view_);
  };

  const renderFull = view =>  {
    tbody.innerHTML = view.map(r => `<tr>
      <td class="s dim">${r.rank ?? "—"}</td>
      <td class="s"><a href="player.html?id=${r.player_id}">${esc(r.player)}</a>${wwNote(r)}</td>
      <td class="s">${teamBadge(r.team)}</td>
      <td class="s">${r.stat}</td>
      <td class="num">${predCell(r, false)}</td>
      <td class="num dim">${fmt(r.floor)}–${fmt(r.ceiling)}</td>
      <td class="num">${fmt(r.minutes)}${r.minutes_source && r.minutes_source !== "model"
        ? ` <span class="badge src">${r.minutes_source}</span>` : ""}</td>
      <td class="num">${fmt(r.line)}</td>
      <td class="s">${r.side ? `<span class="badge ${r.side}">${r.side}</span>` : "—"}</td>
      <td class="num ${r.edge > 0 ? "pos" : ""}">${pct(r.edge)}</td>
      <td class="num ${r.l10_over > 0.5 ? "pos" : r.l10_over != null && r.l10_over < 0.5 ? "neg" : "dim"}">${
        r.l10_over == null ? "—" : (r.l10_over * 100).toFixed(0) + "%"}</td>
      <td class="s">${r.tier ? `<span class="badge ${r.tier}">${r.tier}</span>`
        : (r.gate_status && r.gate_status !== "passed"
           ? `<span class="dim" title="${r.gate_status}">·</span>` : "—")}</td>
    </tr>`).join("") || `<tr><td colspan="12" class="empty">No rows match.</td></tr>`;
  };

  [statSel, tierSel, teamSel, gameSel].forEach(el => el.onchange = render);
  q.oninput = render;
  sortable($("#board"), rows, render);
  // default: real (tiered) edges first, then near-misses, then the rest
  const rank = r => r.tier ? 2 : (r.gate_status === "failed:edge_below_tier" ? 1 : 0);
  rows.sort((a, b) => rank(b) - rank(a) || (b.edge ?? -1) - (a.edge ?? -1));
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
    parts.push(`<line class="projtick" x1="${W - m.r - 14}" x2="${W - m.r}"
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
  const sel = $("#playerSel");
  sel.innerHTML = idx.map(p =>
    `<option value="${p.player_id}">${esc(p.player)} (${esc(p.team)})</option>`).join("");
  const want = new URLSearchParams(location.search).get("id");
  if (want && idx.some(p => String(p.player_id) === want)) sel.value = want;
  sel.onchange = () => { location.search = `?id=${sel.value}`; };
  const pid = sel.value;
  const h = await loadJSON(`data/player_hub/${pid}.json`);

  $("#pname").textContent = h.player;
  document.title = `${h.player} props and stats — the tipoff`;
  $("#pteam").innerHTML = teamBadge(h.team, { withName: true });
  $("#psinglet").innerHTML = playerSinglet(h.team, h.number);
  $("#pmins").innerHTML = h.minutes
    ? `${fmt(h.minutes.value)} min <span class="badge src">${h.minutes.source}</span>`
    : "—";

  const S = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TOV"];
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
  $("#projCards").innerHTML = S.filter(s => h.projections[s]).map(s => {
    const v = h.projections[s];
    return `<div class="card"><div class="k">${s}</div>
      <div class="v">${fmt(v.mean)}</div>
      <div class="r">${fmt(v.floor)}–${fmt(v.ceiling)}</div></div>`;
  }).join("");

  /* --- interactive prop chart --- */
  const CHART_STATS = [...S, "PRA"];
  const log = h.game_log || [];
  const lines = h.lines || {};
  let stat = lines.PTS ? "PTS" : (Object.keys(lines)[0] || "PTS");
  const projOf = s => s === "PRA"
    ? ["PTS", "REB", "AST"].reduce((a, k) =>
        a + (h.projections[k]?.mean || 0), 0)
    : h.projections[s]?.mean;
  const defLine = s => lines[s] ? lines[s].line
    : (projOf(s) != null ? Math.floor(projOf(s)) + 0.5 : 0.5);
  let line = defLine(stat);

  const chipsEl = $("#statChips"), lineEl = $("#lineVal");
  chipsEl.innerHTML = CHART_STATS.map(s =>
    `<button class="chip" data-s="${s}">${s}</button>`).join("");

  const redraw = () => {
    $$(".chip", chipsEl).forEach(c =>
      c.classList.toggle("on", c.dataset.s === stat));
    lineEl.value = line;
    $("#lineSrc").textContent = lines[stat]
      ? (line === lines[stat].line ? `book line (${lines[stat].side}` +
         (lines[stat].tier ? `, tier ${lines[stat].tier})` : ")")
         : "custom line")
      : "no book line — custom";
    const nGames = parseInt($("#rangeSel").value, 10);
    const games = (nGames ? log.slice(-nGames) : log)
      .map(g => ({ ...g, v: statValue(g, stat) }));
    const home = g => (g.venue || "").toUpperCase().startsWith("H");
    const all = log.map(g => ({ ...g, v: statValue(g, stat) }));
    $("#hitCards").innerHTML =
      hitCard("L5", all.slice(-5), line) +
      hitCard("L10", all.slice(-10), line) +
      hitCard("L20", all.slice(-20), line) +
      hitCard("Season", all, line) +
      hitCard("Home", all.filter(home), line) +
      hitCard("Away", all.filter(g => !home(g)), line);
    $("#propChart").innerHTML = renderPropChart(games, line, projOf(stat));
    $("#chartNote").textContent =
      `${games.length} games shown · line ${line}`;

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
    line = defLine(stat);
    redraw();
  };
  $("#lineDown").onclick = () => { line = Math.max(0.5, line - 0.5); redraw(); };
  $("#lineUp").onclick = () => { line = line + 0.5; redraw(); };
  lineEl.onchange = () => {
    const v = parseFloat(lineEl.value);
    if (!isNaN(v) && v > 0) { line = v; redraw(); }
  };
  $("#rangeSel").onchange = redraw;
  redraw();
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
  const lineInputs = {};

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

    $("#logSummary").innerHTML =
      `<div class="card"><div class="k">Games</div>
         <div class="v">${games.length}</div>
         <div class="r">of ${log.length} played</div></div>
       <div class="card"><div class="k">Min avg</div>
         <div class="v">${games.length ? (totMin / games.length).toFixed(1) : "—"}</div>
         <div class="r">median ${games.length ? median(mins).toFixed(1) : "—"}</div></div>`
      + S.map(s => {
          const v = games.map(g => g[s]);
          const avg = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
          return `<div class="card"><div class="k">${s}</div>
            <div class="v">${avg == null ? "—" : avg.toFixed(1)}</div>
            <div class="r">med ${v.length ? median(v).toFixed(1) : "—"}</div></div>`;
        }).join("");

    $("#lineRates tbody").innerHTML = S.map(s => {
      const v = games.map(g => g[s]);
      const avg = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      const per36 = totMin > 0
        ? v.reduce((a, b) => a + b, 0) / totMin * 36 : null;
      const dflt = h.lines?.[s]?.line
        ?? (avg == null ? null : Math.floor(avg) + 0.5);
      const cur = lineInputs[s] ?? dflt;
      const over = cur == null ? null : v.filter(x => x > cur).length;
      const rate = (over == null || !v.length) ? null : over / v.length;
      return `<tr>
        <td class="s"><b>${s}</b></td>
        <td class="num"><input class="lineIn" data-s="${s}" type="number"
          step="0.5" value="${cur == null ? "" : cur}" style="width:72px"></td>
        <td class="num dim">${over == null ? "—" : `${over}/${v.length}`}</td>
        <td class="num ${rate > 0.5 ? "pos" : rate != null && rate < 0.5 ? "neg" : ""}">${
          rate == null ? "—" : (rate * 100).toFixed(0) + "%"}</td>
        <td class="num">${avg == null ? "—" : avg.toFixed(1)}</td>
        <td class="num">${v.length ? median(v).toFixed(1) : "—"}</td>
        <td class="num dim">${per36 == null ? "—" : per36.toFixed(1)}</td>
      </tr>`;
    }).join("");
    $$(".lineIn", $("#lineRates")).forEach(inp => {
      inp.onchange = () => {
        const v = parseFloat(inp.value);
        lineInputs[inp.dataset.s] = isNaN(v) ? null : v;
        renderLog();
      };
    });

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
    </tr>`).join("")
      || `<tr><td colspan="13" class="empty">No games match these filters.</td></tr>`;
  };

  ["#fLast", "#fLoc", "#fRole", "#fRest", "#fOpp", "#fResult",
   "#fTier"].forEach(sel => $(sel).onchange = renderLog);
  ["#fMinLo", "#fMinHi"].forEach(sel => $(sel).oninput = renderLog);
  $("#fReset").onclick = () => {
    $("#fLast").value = "15"; $("#fLoc").value = "all";
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
  if (data.coverage != null) {
    const note = document.createElement("p");
    note.className = "sub";
    note.innerHTML = `Positions are the 5-way split (PG/SG/SF/PF/C) from
      the vendor roster map, covering <b>${(data.coverage * 100).toFixed(0)}%</b>
      of minutes played; unmapped deep-bench players are excluded rather
      than folded into a coarse bucket.`;
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
  const s = d.summary;
  $("#recCards").innerHTML = `
    <div class="card"><div class="k">Graded edges</div><div class="v">${s.n_graded}</div></div>
    <div class="card"><div class="k">Hit rate</div><div class="v">${pct(s.hit_rate)}</div></div>
    <div class="card"><div class="k">ROI (flat, tier A)</div><div class="v">${pct(s.roi)}</div></div>
    <div class="card"><div class="k">Avg CLV</div><div class="v">${pct(s.avg_clv)}</div></div>`;
  $("#recnote").textContent = d.note || "";
  const tbody = $("#rec tbody");
  tbody.innerHTML = d.rows.length ? d.rows.map(r => `<tr>
    <td class="s dim">${r.slate_date}</td><td class="s">${r.market}</td>
    <td class="s"><span class="badge ${r.side}">${r.side}</span></td>
    <td class="num">${fmt(r.line)}</td><td class="num">${fmt(r.price, 2)}</td>
    <td class="s">${r.tier ? `<span class="badge ${r.tier}">${r.tier}</span>` : "—"}</td>
    <td class="s">${r.result ?? "ungraded"}</td>
    <td class="num ${r.clv > 0 ? "pos" : r.clv < 0 ? "neg" : ""}">${pct(r.clv)}</td>
  </tr>`).join("")
    : `<tr><td colspan="8" class="empty">Populates forward-only from opening
       night — every gated edge, bet or not. No back-filled picks.</td></tr>`;
}

/* ---------- boot ---------- */
addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  const boot = { board: initBoard, player: initPlayer,
                 wow: initWow, record: initRecord,
                 matchups: initMatchups, boxscore: initBoxscore }[page];
  if (boot) boot().catch(e => {
    const m = $("main");
    if (m) m.innerHTML = `<div class="empty">Data not available yet
      (${e.message}). The nightly run publishes it here.</div>`;
  });
});
