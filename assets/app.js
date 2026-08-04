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

/* ---------- data + freshness ---------- */
async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

async function renderFreshness() {
  try {
    const m = await loadJSON("data/meta.json");
    const el = $("#fresh");
    if (!el) return m;
    const build = m.build === "late" ? "late refresh (near lock)" : "overnight main build";
    el.innerHTML =
      `Slate <b>${m.slate_date}</b> · ${build} · computed <b>${m.computed_at}</b>` +
      ` · <span class="dim">${m.model_version}</span>` +
      (m.demo ? ` · <span class="demo">FIXTURE DEMO — not live data</span>` : "");
    return m;
  } catch { return null; }
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
    rows.sort((a, b) => {
      const x = a[k], y = b[k];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * -dir;
    });
    render();
  });
}

/* ---------- board page ---------- */
async function initBoard() {
  await renderFreshness();
  const data = await loadJSON("data/projections.json");
  let rows = data.rows;
  const tbody = $("#board tbody");
  const statSel = $("#fStat"), tierSel = $("#fTier"),
        teamSel = $("#fTeam"), q = $("#fQ");
  [...new Set(rows.map(r => r.team).filter(Boolean))].sort().forEach(t => {
    const o = document.createElement("option");
    o.value = o.textContent = t;
    teamSel.append(o);
  });

  const render = () => {
    const s = statSel.value, t = tierSel.value, tm = teamSel.value,
          needle = q.value.toLowerCase();
    const view = rows.filter(r =>
      (s === "all" || r.stat === s) &&
      (t === "all" || (t === "gated" ? r.tier : r.tier === t)) &&
      (tm === "all" || r.team === tm) &&
      (!needle || r.player.toLowerCase().includes(needle)));
    tbody.innerHTML = view.map(r => `<tr>
      <td class="s"><a href="player.html?id=${r.player_id}">${esc(r.player)}</a></td>
      <td class="s dim">${esc(r.team || "")}</td>
      <td class="s">${r.stat}</td>
      <td class="num">${fmt(r.proj)}</td>
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
    </tr>`).join("") || `<tr><td colspan="11" class="empty">No rows match.</td></tr>`;
  };

  [statSel, tierSel].forEach(el => el.onchange = render);
  q.oninput = render;
  sortable($("#board"), rows, render);
  // default: real (tiered) edges first, then near-misses, then the rest
  const rank = r => r.tier ? 2 : (r.gate_status === "failed:edge_below_tier" ? 1 : 0);
  rows.sort((a, b) => rank(b) - rank(a) || (b.edge ?? -1) - (a.edge ?? -1));
  render();
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
  $("#pteam").textContent = h.team;
  $("#pmins").innerHTML = h.minutes
    ? `${fmt(h.minutes.value)} min <span class="badge src">${h.minutes.source}</span>`
    : "—";

  const S = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TOV"];
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

  $("#gamelog tbody").innerHTML = h.recent_games.map(g => `<tr>
    <td class="s">${g.game
      ? `<a href="boxscore.html?g=${encodeURIComponent(g.game)}"
           target="_blank" rel="noopener" title="open box score">${g.date} ↗</a>`
      : `<span class="dim">${g.date}</span>`}</td>
    <td class="s">${esc(g.opp || "")}</td>
    <td class="num">${fmt(g.min)}</td>
    ${S.map(s => `<td class="num">${fmt(g[s], 0)}</td>`).join("")}
  </tr>`).join("");
}

/* ---------- with & without page ---------- */
async function initWow() {
  await renderFreshness();
  const data = await loadJSON("data/with_without.json");
  $("#wownote").textContent = data.note || "";
  let rows = data.pairs;
  const tbody = $("#wow tbody"), q = $("#fQ");
  const render = () => {
    const needle = q.value.toLowerCase();
    const view = rows.filter(r => !needle
      || r.focal.toLowerCase().includes(needle)
      || r.key_out.toLowerCase().includes(needle)
      || (r.team || "").toLowerCase().includes(needle));
    tbody.innerHTML = view.slice(0, 400).map(r => `<tr>
      <td class="s">${esc(r.focal)}</td><td class="s">${esc(r.key_out)}</td>
      <td class="s dim">${esc(r.team)}</td>
      <td class="num">${fmt(r.min_with)} → ${fmt(r.min_without)}</td>
      <td class="num ${r.d_min > 0 ? "pos" : r.d_min < 0 ? "neg" : ""}">${fmt(r.d_min)}</td>
      <td class="num">${fmt(r.pts_with)} → ${fmt(r.pts_without)}</td>
      <td class="num ${r.d_pts > 0 ? "pos" : r.d_pts < 0 ? "neg" : ""}">${fmt(r.d_pts)}</td>
      <td class="num dim">${r.n_with}/${r.n_without}</td>
    </tr>`).join("") || `<tr><td colspan="8" class="empty">No pairs match.</td></tr>`;
  };
  q.oninput = render;
  sortable($("#wow"), rows, render);
  rows.sort((a, b) => (b.d_pts ?? 0) - (a.d_pts ?? 0));
  render();
}

/* ---------- matchups page ---------- */
async function initMatchups() {
  await renderFreshness();
  const data = await loadJSON("data/matchups.json");
  const S = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TOV"];
  const positions = [...new Set(
    Object.values(data.windows).flat().map(r => r.pos))].sort();
  let pos = positions.includes("G") ? "G" : positions[0];
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
      <td class="s">${esc(r.team)}</td>
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
    <div class="section"><h2>${esc(team)}</h2></div>
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
