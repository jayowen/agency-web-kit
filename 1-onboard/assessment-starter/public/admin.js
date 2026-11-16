// Brand assessment admin dashboard.
// Everything client-specific comes from /client.config.json.
// No chart library, no CDN, no build step.
//
// HTML safety: every dynamic value is escaped with esc() at the point it is
// interpolated into a template string. setHTML() below is the single place
// where markup reaches the DOM, so there is one sink to audit.

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

const state = {
  config: null,
  pw: "",
  storageKey: "ba-admin-pw",
  respondents: [],
  loadedAt: null,
  view: "responses",
  filters: {
    segment: "all", // "all" | tag id | "custom"
    custom: new Set(),
    role: "",
    tenure: "",
    compare: false,
  },
  sort: { key: "submitted_at", dir: "desc" },
  quoteSearch: "",
  pickerSearch: "",
  roster: "",
};

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Single HTML sink. Callers must pass markup built from esc()-escaped values.
function setHTML(el, markup) {
  if (!el) return;
  el.replaceChildren();
  el.insertAdjacentHTML("beforeend", markup);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mean(list) {
  if (!list.length) return null;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function stdev(list) {
  if (list.length < 2) return 0;
  const m = mean(list);
  const v = list.reduce((a, b) => a + (b - m) * (b - m), 0) / list.length;
  return Math.sqrt(v);
}

function pct(part, whole) {
  if (!whole) return 0;
  return (part / whole) * 100;
}

function fmt(n, places = 1) {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return n.toFixed(places);
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtTime(d) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function toast(msg, bad = false) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("is-bad", !!bad);
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, 2600);
}

function isUrl(v) {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim());
}

function safeHref(v) {
  const s = String(v || "").trim();
  if (isUrl(s)) return esc(s);
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s)) return esc(`https://${s}`);
  return "";
}

function linkify(v) {
  const href = safeHref(v);
  if (!href) return esc(v);
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${esc(
    v
  )}</a>`;
}

/* ------------------------------------------------------------------ *
 * Config accessors
 * ------------------------------------------------------------------ */

const IDENTITY_TYPES = new Set([
  "identity_name",
  "identity_email",
  "identity_select",
]);

const OPEN_TEXT_TYPES = new Set(["textarea", "text", "sentence"]);

function allQuestions() {
  const out = [];
  const sections = (state.config && state.config.sections) || [];
  for (const s of sections) {
    for (const q of s.questions || []) {
      if (IDENTITY_TYPES.has(q.type)) continue;
      out.push({ ...q, sectionId: s.id, sectionTitle: s.title });
    }
  }
  return out;
}

function questionsOfType(type) {
  return allQuestions().filter((q) => q.type === type);
}

function tagDefs() {
  const t = state.config && state.config.admin && state.config.admin.tags;
  return Array.isArray(t) ? t : [];
}

function tagDef(id) {
  return (
    tagDefs().find((t) => t.id === id) || { id, label: id, color: "#8a8a8a" }
  );
}

function questionTitle(q) {
  if (q.label) return q.label;
  if (q.left && q.right) return `${q.left} to ${q.right}`;
  if (q.prefix) return q.prefix;
  return q.key;
}

// A wordbank block can be marked negative in config with `negative: true`.
// Without that flag we read the wording of the question instead.
function isNegativeWordbank(q) {
  if (typeof q.negative === "boolean") return q.negative;
  return /\b(not|never|avoid)\b/i.test(`${q.key} ${q.label || ""}`);
}

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${state.pw}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    const err = new Error("unauthorized");
    err.status = 401;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data && data.error) || `http_${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function showGate(message) {
  $("#app").hidden = true;
  const gate = $("#gate");
  gate.hidden = false;
  const errEl = $("#gate-error");
  if (message) {
    errEl.textContent = message;
    errEl.hidden = false;
  } else {
    errEl.hidden = true;
  }
  const input = $("#gate-pw");
  input.value = "";
  input.focus();
}

async function tryPassword(pw) {
  state.pw = pw;
  const res = await api("/api/admin/check");
  state.role = res.role || "admin";
  sessionStorage.setItem(state.storageKey, pw);
}

function signOut() {
  sessionStorage.removeItem(state.storageKey);
  state.pw = "";
  state.respondents = [];
  showGate("Signed out.");
}

/* ------------------------------------------------------------------ *
 * Data loading
 * ------------------------------------------------------------------ */

async function loadData() {
  const data = await api("/api/admin/data");
  state.respondents = (data.respondents || []).map((r) => ({
    ...r,
    tags: Array.isArray(r.tags) ? r.tags : [],
    answers: r.answers || {},
  }));
  state.loadedAt = new Date();
  const el = $("#last-loaded");
  if (el) el.textContent = `Loaded ${fmtTime(state.loadedAt)}`;
}

/* ------------------------------------------------------------------ *
 * Filtering
 * ------------------------------------------------------------------ */

function everyone() {
  return state.respondents;
}

function segmentBase() {
  const f = state.filters;
  if (f.segment === "all") return state.respondents;
  if (f.segment === "custom") {
    return state.respondents.filter((r) => f.custom.has(r.id));
  }
  return state.respondents.filter(
    (r) => Array.isArray(r.tags) && r.tags.includes(f.segment)
  );
}

function segment() {
  const f = state.filters;
  return segmentBase().filter((r) => {
    if (f.role && (r.role || "") !== f.role) return false;
    if (f.tenure && (r.tenure || "") !== f.tenure) return false;
    return true;
  });
}

function segmentName() {
  const f = state.filters;
  const bits = [];
  if (f.segment === "all") bits.push("Everyone");
  else if (f.segment === "custom")
    bits.push(`Custom pick (${f.custom.size} selected)`);
  else bits.push(tagDef(f.segment).label);
  if (f.role) bits.push(f.role);
  if (f.tenure) bits.push(f.tenure);
  return bits.join(" / ");
}

function isFiltered() {
  const f = state.filters;
  return f.segment !== "all" || !!f.role || !!f.tenure;
}

function comparing() {
  return state.filters.compare && isFiltered();
}

/* ------------------------------------------------------------------ *
 * Aggregation. One summarize() per question type.
 * Returns { n, items:[{id,label,count,pct,extra}], stats:{...} }
 * ------------------------------------------------------------------ */

function rawAnswers(list, key) {
  const out = [];
  for (const r of list) {
    const v = r.answers ? r.answers[key] : undefined;
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    if (Array.isArray(v) && !v.length) continue;
    out.push({ r, v });
  }
  return out;
}

function countMap(pairs) {
  const m = new Map();
  for (const [id, weight] of pairs) {
    m.set(id, (m.get(id) || 0) + (weight == null ? 1 : weight));
  }
  return m;
}

function summarize(q, list) {
  switch (q.type) {
    case "slider_pair":
      return sumSliderPair(q, list);
    case "wordbank":
      return sumWordbank(q, list);
    case "ab_pair":
      return sumAbPair(q, list);
    case "palette_grid":
      return sumPalette(q, list);
    case "multi_select":
      return sumMultiSelect(q, list);
    case "image_pick":
      return sumImagePick(q, list);
    case "rating":
      return sumRating(q, list);
    case "repeater":
      return sumRepeater(q, list);
    case "textarea":
    case "text":
    case "sentence":
      return sumOpenText(q, list);
    default:
      return { n: 0, items: [], stats: {} };
  }
}

function sumSliderPair(q, list) {
  const min = num(q.min) || 1;
  const max = num(q.max) || 7;
  const cur = [];
  const des = [];
  const rows = rawAnswers(list, q.key);
  for (const { v } of rows) {
    if (!v || typeof v !== "object") continue;
    const c = num(v.current);
    const d = num(v.desired);
    if (c != null) cur.push(c);
    if (d != null) des.push(d);
  }
  const curAvg = mean(cur);
  const desAvg = mean(des);
  return {
    n: rows.length,
    items: [],
    stats: {
      min,
      max,
      curAvg,
      desAvg,
      curN: cur.length,
      desN: des.length,
      gap: curAvg != null && desAvg != null ? desAvg - curAvg : null,
      desSd: stdev(des),
      curSd: stdev(cur),
      desired: des,
    },
  };
}

function sumWordbank(q, list) {
  const known = new Set((q.words || []).map((w) => String(w).toLowerCase()));
  const rows = rawAnswers(list, q.key);
  const pairs = [];
  for (const { v } of rows) {
    const arr = Array.isArray(v) ? v : [v];
    for (const w of arr) {
      const s = String(w || "").trim();
      if (s) pairs.push([s.toLowerCase(), 1]);
    }
  }
  const m = countMap(pairs);
  const total = Array.from(m.values()).reduce((a, b) => a + b, 0);
  const items = Array.from(m.entries())
    .map(([id, count]) => ({
      id,
      label: id,
      count,
      pct: pct(count, rows.length || 1),
      extra: { writeIn: !known.has(id) },
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    n: rows.length,
    items,
    stats: {
      total,
      picksPerPerson: num(q.count) || 1,
      optionCount: Math.max((q.words || []).length, items.length),
      negative: isNegativeWordbank(q),
    },
  };
}

function sumAbPair(q, list) {
  const a = q.a || {};
  const b = q.b || {};
  const rows = rawAnswers(list, q.key);
  let aCount = 0;
  let bCount = 0;
  for (const { v } of rows) {
    if (v === a.id) aCount++;
    else if (v === b.id) bCount++;
  }
  const n = aCount + bCount;
  return {
    n,
    items: [
      {
        id: a.id,
        label: a.label || a.id || "Option A",
        count: aCount,
        pct: pct(aCount, n),
        extra: { img: a.img },
      },
      {
        id: b.id,
        label: b.label || b.id || "Option B",
        count: bCount,
        pct: pct(bCount, n),
        extra: { img: b.img },
      },
    ],
    stats: { aCount, bCount },
  };
}

function sumPalette(q, list) {
  const defs = new Map((q.palettes || []).map((p) => [p.id, p]));
  const rows = rawAnswers(list, q.key);
  const pairs = [];
  for (const { v } of rows) {
    const arr = Array.isArray(v) ? v : [v];
    for (const id of arr) if (id) pairs.push([String(id), 1]);
  }
  const m = countMap(pairs);
  const items = Array.from(m.entries())
    .map(([id, count]) => {
      const def = defs.get(id) || { name: id, colors: [] };
      return {
        id,
        label: def.name || id,
        count,
        pct: pct(count, rows.length || 1),
        extra: { colors: def.colors || [] },
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    n: rows.length,
    items,
    stats: {
      picksPerPerson: num(q.max) || num(q.min) || 1,
      optionCount: Math.max((q.palettes || []).length, items.length),
    },
  };
}

function sumMultiSelect(q, list) {
  const defs = new Map((q.options || []).map((o) => [o.id, o]));
  const rows = rawAnswers(list, q.key);
  const pairs = [];
  for (const { v } of rows) {
    const arr = Array.isArray(v) ? v : [v];
    for (const id of arr) if (id) pairs.push([String(id), 1]);
  }
  const m = countMap(pairs);
  const items = Array.from(m.entries())
    .map(([id, count]) => ({
      id,
      label: (defs.get(id) || {}).label || id,
      count,
      pct: pct(count, rows.length || 1),
      extra: {},
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    n: rows.length,
    items,
    stats: {
      picksPerPerson: num(q.count) || 1,
      optionCount: Math.max((q.options || []).length, items.length),
    },
  };
}

// image_pick. The stored answer is an array of tile ids.
//
// Two rankings come out of one pass:
//   families: how many PEOPLE touched each family, each person counted at most
//             once per family even when they picked several tiles from it, and
//             counted in every family a dual-family tile belongs to.
//   tiles:    how many people picked each tile, every configured tile listed so
//             the zero-pick ones stay visible.
//
// Both percentages use the same denominator: people in this list who answered
// this question at all. Tile ids that are not in the config are skipped.
// `items` holds the family ranking, because family is the meaningful signal for
// consensus and divergence. Without a `families` key it holds the tiles instead.
function sumImagePick(q, list) {
  const tileDefs = (Array.isArray(q.tiles) ? q.tiles : []).filter(
    (t) => t && t.id != null && String(t.id) !== ""
  );
  const tileById = new Map();
  tileDefs.forEach((t, i) => tileById.set(String(t.id), { def: t, order: i }));

  const famDefs = (Array.isArray(q.families) ? q.families : []).filter(
    (f) => f && f.id != null && String(f.id) !== ""
  );
  const hasFamilies = famDefs.length > 0;
  const famLabel = new Map();
  const famOrder = new Map();
  famDefs.forEach((f, i) => {
    famLabel.set(String(f.id), f.label || String(f.id));
    famOrder.set(String(f.id), i);
  });

  const rows = rawAnswers(list, q.key);
  const tileCounts = new Map();
  const famCounts = new Map();
  let tilePicks = 0;
  let famTouches = 0;

  for (const { v } of rows) {
    const arr = Array.isArray(v) ? v : [v];
    const tilesSeen = new Set();
    const famsSeen = new Set();
    for (const raw of arr) {
      const id = String(raw == null ? "" : raw).trim();
      if (!id) continue;
      const hit = tileById.get(id);
      if (!hit) continue;
      tilesSeen.add(id);
      for (const f of hit.def.families || []) {
        const fid = String(f == null ? "" : f).trim();
        if (fid) famsSeen.add(fid);
      }
    }
    // Sets are what stop one person counting twice for the same family or tile.
    for (const id of tilesSeen) tileCounts.set(id, (tileCounts.get(id) || 0) + 1);
    for (const fid of famsSeen) famCounts.set(fid, (famCounts.get(fid) || 0) + 1);
    tilePicks += tilesSeen.size;
    famTouches += famsSeen.size;
  }

  const denom = rows.length || 1;

  const tileItems = tileDefs
    .map((t, i) => {
      const id = String(t.id);
      const count = tileCounts.get(id) || 0;
      return {
        id,
        label: t.label || id,
        count,
        pct: pct(count, denom),
        extra: { img: t.img || "", order: i, families: t.families || [] },
      };
    })
    .sort((a, b) => b.count - a.count || a.extra.order - b.extra.order);

  // Every configured family, plus any family id a tile carries that the config
  // forgot to declare. Zero-pick families stay in the list on purpose.
  const famIds = new Set(famDefs.map((f) => String(f.id)));
  for (const t of tileDefs) {
    for (const f of t.families || []) {
      const fid = String(f == null ? "" : f).trim();
      if (fid) famIds.add(fid);
    }
  }
  const famItems = Array.from(famIds)
    .map((fid) => ({
      id: fid,
      label: famLabel.get(fid) || fid,
      count: famCounts.get(fid) || 0,
      pct: pct(famCounts.get(fid) || 0, denom),
      extra: { order: famOrder.has(fid) ? famOrder.get(fid) : 9999 },
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.extra.order - b.extra.order ||
        a.label.localeCompare(b.label)
    );

  const avgFamilies = rows.length ? famTouches / rows.length : 0;
  const avgTiles = rows.length ? tilePicks / rows.length : 0;

  return {
    n: rows.length,
    items: hasFamilies ? famItems : tileItems,
    stats: {
      hasFamilies,
      families: famItems,
      tiles: tileItems,
      answered: rows.length,
      tilePicks,
      famTouches,
      avgFamilies,
      avgTiles,
      // Consensus reads these two, same contract as wordbank and palette_grid.
      picksPerPerson: Math.max(
        1,
        Math.round(hasFamilies ? avgFamilies : avgTiles)
      ),
      optionCount: hasFamilies
        ? Math.max(famItems.length, 1)
        : Math.max(tileItems.length, 1),
    },
  };
}

function sumRating(q, list) {
  const min = num(q.min) != null ? num(q.min) : 1;
  const max = num(q.max) != null ? num(q.max) : 5;
  const rows = rawAnswers(list, q.key);
  const vals = [];
  for (const { v } of rows) {
    const n = num(v);
    if (n != null) vals.push(n);
  }
  const items = [];
  for (let i = min; i <= max; i++) {
    const count = vals.filter((v) => Math.round(v) === i).length;
    items.push({
      id: String(i),
      label: String(i),
      count,
      pct: pct(count, vals.length),
      extra: {},
    });
  }
  return {
    n: vals.length,
    items,
    stats: {
      min,
      max,
      avg: mean(vals),
      sd: stdev(vals),
      values: vals,
      minLabel: q.minLabel || "",
      maxLabel: q.maxLabel || "",
    },
  };
}

function sumRepeater(q, list) {
  const fields = q.fields || [];
  const primary = fields[0] ? fields[0].key : null;
  const rows = rawAnswers(list, q.key);
  const groups = new Map();
  let entries = 0;
  for (const { r, v } of rows) {
    const arr = Array.isArray(v) ? v : [v];
    for (const row of arr) {
      if (!row || typeof row !== "object") continue;
      const rawKey = primary ? row[primary] : Object.values(row)[0];
      const display = String(rawKey || "").trim();
      if (!display) continue;
      entries++;
      const gk = display.toLowerCase().replace(/\/+$/, "");
      if (!groups.has(gk)) {
        groups.set(gk, { id: gk, label: display, count: 0, notes: [] });
      }
      const g = groups.get(gk);
      g.count++;
      for (const f of fields) {
        if (f.key === primary) continue;
        const val = String(row[f.key] || "").trim();
        if (!val) continue;
        g.notes.push({ field: f, value: val, person: r });
      }
    }
  }
  const items = Array.from(groups.values())
    .map((g) => ({
      id: g.id,
      label: g.label,
      count: g.count,
      pct: pct(g.count, rows.length || 1),
      extra: { notes: g.notes },
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { n: rows.length, items, stats: { entries, fields, primary } };
}

function sumOpenText(q, list) {
  const rows = rawAnswers(list, q.key);
  const items = rows
    .map(({ r, v }) => ({
      id: r.id,
      label: String(v),
      count: 1,
      pct: 0,
      extra: { person: r },
    }))
    .filter((i) => i.label.trim().length);
  return { n: items.length, items, stats: { prefix: q.prefix || "" } };
}

/* ------------------------------------------------------------------ *
 * Consensus scoring
 * ------------------------------------------------------------------ */

// Concentration of picks in the top N choices against an even spread.
function concentrationScore(agg) {
  const items = agg.items;
  if (!items.length || !agg.n) return null;
  const total = items.reduce((a, b) => a + b.count, 0);
  if (!total) return null;
  const picks = Math.max(1, Math.round(agg.stats.picksPerPerson || 1));
  const options = Math.max(agg.stats.optionCount || items.length, items.length);
  if (options <= picks) return 100;
  const topShare =
    items.slice(0, picks).reduce((a, b) => a + b.count, 0) / total;
  const evenShare = picks / options;
  if (evenShare >= 1) return 100;
  const score = ((topShare - evenShare) / (1 - evenShare)) * 100;
  return Math.max(0, Math.min(100, score));
}

function spreadScore(values, min, max) {
  if (!values || values.length === 0) return null;
  if (values.length === 1) return 100;
  const maxSd = (max - min) / 2;
  if (!Number.isFinite(maxSd) || maxSd <= 0) return 100;
  const score = (1 - stdev(values) / maxSd) * 100;
  return Math.max(0, Math.min(100, score));
}

function consensusScore(q, agg) {
  if (!agg || !agg.n) return null;
  switch (q.type) {
    case "ab_pair": {
      const share = agg.items[0].count / agg.n;
      return Math.max(0, Math.min(100, Math.abs(share - 0.5) * 2 * 100));
    }
    case "slider_pair":
      return spreadScore(agg.stats.desired, agg.stats.min, agg.stats.max);
    case "rating":
      return spreadScore(agg.stats.values, agg.stats.min, agg.stats.max);
    case "wordbank":
    case "multi_select":
    case "palette_grid":
      return concentrationScore(agg);
    // image_pick scores on the family distribution. agg.items is the family
    // ranking, so the same concentration method applies unchanged.
    case "image_pick":
      return concentrationScore(agg);
    default:
      return null;
  }
}

const SCORED_TYPES = new Set([
  "ab_pair",
  "slider_pair",
  "rating",
  "wordbank",
  "multi_select",
  "palette_grid",
  "image_pick",
]);

// Top answer id, used to detect divergence between segment and everyone.
function topAnswer(q, agg) {
  if (!agg || !agg.n) return null;
  if (q.type === "slider_pair" || q.type === "rating") return null;
  const items = agg.items.filter((i) => i.count > 0);
  if (!items.length) return null;
  return items[0].id;
}

// What the top item actually is, so the divergence sentence reads plainly.
function topNoun(q, agg) {
  if (q.type !== "image_pick") return "Top answer";
  return agg && agg.stats && agg.stats.hasFamilies
    ? "Top style family"
    : "Top style pick";
}

function meanOf(q, agg) {
  if (!agg || !agg.n) return null;
  if (q.type === "slider_pair") return agg.stats.desAvg;
  if (q.type === "rating") return agg.stats.avg;
  return null;
}

// One step on the question's own scale.
function scaleStep(q, agg) {
  const min = agg.stats.min;
  const max = agg.stats.max;
  if (min == null || max == null || max <= min) return 1;
  if (q.type === "slider_pair") return (max - min) / 6;
  return 1;
}

function divergences() {
  if (!isFiltered()) return [];
  const seg = segment();
  const all = everyone();
  if (!seg.length) return [];
  const out = [];
  for (const q of allQuestions()) {
    if (!SCORED_TYPES.has(q.type)) continue;
    const aSeg = summarize(q, seg);
    const aAll = summarize(q, all);
    if (!aSeg.n || !aAll.n) continue;

    const topSeg = topAnswer(q, aSeg);
    const topAll = topAnswer(q, aAll);
    if (topSeg && topAll && topSeg !== topAll) {
      const segLabel = (aSeg.items.find((i) => i.id === topSeg) || {}).label;
      const allLabel = (aAll.items.find((i) => i.id === topAll) || {}).label;
      out.push({
        q,
        kind: "top",
        detail: `${topNoun(
          q,
          aSeg
        )} differs. This segment picks "${segLabel}". Everyone picks "${allLabel}".`,
      });
      continue;
    }

    const mSeg = meanOf(q, aSeg);
    const mAll = meanOf(q, aAll);
    if (mSeg != null && mAll != null) {
      const step = scaleStep(q, aSeg);
      const shift = mSeg - mAll;
      if (Math.abs(shift) > step) {
        out.push({
          q,
          kind: "mean",
          detail: `Average moves ${shift > 0 ? "up" : "down"} ${fmt(
            Math.abs(shift)
          )} points. Segment sits at ${fmt(mSeg)}, everyone at ${fmt(mAll)}.`,
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Chart pieces
 * ------------------------------------------------------------------ */

function emptyBlock(msg) {
  return `<div class="empty">${esc(msg)}</div>`;
}

function legendRow() {
  if (!comparing()) return "";
  return `<div class="legend">
    <span class="legend-item"><span class="legend-swatch is-seg"></span>${esc(
      segmentName()
    )}</span>
    <span class="legend-item"><span class="legend-swatch is-all"></span>Everyone (${
      everyone().length
    })</span>
  </div>`;
}

function markerPct(v, min, max) {
  if (v == null || max <= min) return 0;
  const p = ((v - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, p));
}

function dumbbellTrack(stats, seriesLabel, variant) {
  const { min, max, curAvg, desAvg } = stats;
  if (curAvg == null && desAvg == null) {
    return `<div class="db-row is-${esc(variant)}">
      <span class="db-series">${esc(seriesLabel)}</span>
      <div class="db-track is-empty"><span class="db-none">No answers yet</span></div>
    </div>`;
  }
  const cp = markerPct(curAvg, min, max);
  const dp = markerPct(desAvg, min, max);
  const left = Math.min(cp, dp);
  const width = Math.abs(dp - cp);
  const steps = Math.max(1, Math.round(max - min));
  const ticks = [];
  for (let i = 0; i <= steps; i++) {
    ticks.push(`<span class="db-tick" style="left:${(i / steps) * 100}%"></span>`);
  }
  return `<div class="db-row is-${esc(variant)}">
    <span class="db-series">${esc(seriesLabel)}</span>
    <div class="db-track">
      ${ticks.join("")}
      <div class="db-gap" style="left:${left}%;width:${width}%"></div>
      ${
        curAvg != null
          ? `<div class="db-marker db-today" style="left:${cp}%"><span class="db-val">${esc(
              fmt(curAvg)
            )}</span></div>`
          : ""
      }
      ${
        desAvg != null
          ? `<div class="db-marker db-should" style="left:${dp}%"><span class="db-val">${esc(
              fmt(desAvg)
            )}</span></div>`
          : ""
      }
    </div>
  </div>`;
}

function dumbbell(q, aSeg, aAll) {
  const gap = aSeg.stats.gap;
  const rows = [
    dumbbellTrack(
      aSeg.stats,
      comparing() ? segmentName() : "Average",
      "seg"
    ),
  ];
  if (comparing() && aAll) rows.push(dumbbellTrack(aAll.stats, "Everyone", "all"));

  const gapNote =
    gap == null
      ? "No gap to show yet"
      : Math.abs(gap) < 0.25
      ? "Today and should be sit on top of each other"
      : `Wants to move ${fmt(Math.abs(gap))} toward ${
          gap > 0 ? q.right || "the right" : q.left || "the left"
        }`;

  return `<section class="card chart-card">
    <header class="chart-head">
      <h3 class="chart-title">${esc(q.left || "")} <span class="chart-vs">to</span> ${esc(
    q.right || ""
  )}</h3>
      <span class="chart-n">${aSeg.n} answered</span>
    </header>
    <div class="db-ends"><span>${esc(q.left || aSeg.stats.min)}</span><span>${esc(
    q.right || aSeg.stats.max
  )}</span></div>
    <div class="db">${rows.join("")}</div>
    <div class="db-foot">
      <span class="db-key"><span class="db-chip db-chip-today"></span>Today</span>
      <span class="db-key"><span class="db-chip db-chip-should"></span>Should be</span>
      <span class="db-gapnote">${esc(gapNote)}</span>
    </div>
  </section>`;
}

function barList(agg, aAll, opts = {}) {
  const items = agg.items.slice(0, opts.limit || 999);
  if (!items.length) return emptyBlock("Nobody in this segment answered this one.");
  const compare = comparing() && aAll && aAll.n;
  const maxPct = Math.max(
    1,
    ...items.map((i) => i.pct),
    ...(compare ? aAll.items.map((i) => i.pct) : [0])
  );
  const rows = items.map((i) => {
    const allItem = compare ? aAll.items.find((x) => x.id === i.id) : null;
    const w = (i.pct / maxPct) * 100;
    const wAll = allItem ? (allItem.pct / maxPct) * 100 : 0;
    return `<div class="bar-row">
      <div class="bar-label">${esc(i.label)}${
      i.extra && i.extra.writeIn
        ? ' <span class="tagpill tagpill-writein">write-in</span>'
        : ""
    }</div>
      <div class="bar-track">
        <div class="bar-fill ${opts.alert ? "is-alert" : ""}" style="width:${w}%"></div>
        ${compare ? `<div class="bar-fill is-all" style="width:${wAll}%"></div>` : ""}
      </div>
      <div class="bar-value"><span class="bar-count">${i.count}</span><span class="bar-pct">${Math.round(
      i.pct
    )}%</span>${
      compare
        ? `<span class="bar-allpct">all ${
            allItem ? Math.round(allItem.pct) : 0
          }%</span>`
        : ""
    }</div>
    </div>`;
  });
  return `<div class="bars">${rows.join("")}</div>`;
}

function splitBar(q, agg, aAll) {
  if (!agg.n) {
    return `<section class="card chart-card">
      <header class="chart-head"><h3 class="chart-title">${esc(
        questionTitle(q)
      )}</h3></header>
      ${emptyBlock("Nobody in this segment answered this one.")}
    </section>`;
  }
  const a = agg.items[0];
  const b = agg.items[1];
  const aPct = a.pct;
  const compare = comparing() && aAll && aAll.n;
  const allA = compare ? aAll.items[0].pct : null;
  return `<section class="card chart-card ab-card">
    <header class="chart-head">
      <h3 class="chart-title">${esc(a.label)} <span class="chart-vs">or</span> ${esc(
    b.label
  )}</h3>
      <span class="chart-n">${agg.n} answered</span>
    </header>
    <div class="split">
      <div class="split-bar">
        <div class="split-a" style="width:${aPct}%"><span>${Math.round(
    aPct
  )}%</span></div>
        <div class="split-b" style="width:${100 - aPct}%"><span>${Math.round(
    100 - aPct
  )}%</span></div>
      </div>
      <div class="split-ends"><span>${esc(a.label)} (${a.count})</span><span>${esc(
    b.label
  )} (${b.count})</span></div>
      ${
        compare
          ? `<div class="split-bar is-all">
              <div class="split-a" style="width:${allA}%"><span>${Math.round(
              allA
            )}%</span></div>
              <div class="split-b" style="width:${100 - allA}%"><span>${Math.round(
              100 - allA
            )}%</span></div>
            </div>
            <div class="split-ends is-muted"><span>Everyone</span><span>${
              aAll.n
            } answered</span></div>`
          : ""
      }
    </div>
  </section>`;
}

function paletteList(agg, aAll) {
  if (!agg.items.length)
    return emptyBlock("No palettes picked inside this segment.");
  const compare = comparing() && aAll && aAll.n;
  return `<div class="palettes">${agg.items
    .map((i) => {
      const allItem = compare ? aAll.items.find((x) => x.id === i.id) : null;
      const swatches = (i.extra.colors || [])
        .map((c) => `<span class="sw" style="background:${esc(c)}"></span>`)
        .join("");
      return `<div class="palette-row">
        <div class="palette-strip">${
          swatches || '<span class="sw sw-empty"></span>'
        }</div>
        <div class="palette-meta">
          <strong>${esc(i.label)}</strong>
          <span class="palette-count">${i.count} picks · ${Math.round(i.pct)}%${
        allItem ? ` · everyone ${Math.round(allItem.pct)}%` : ""
      }</span>
        </div>
        <div class="palette-bar"><div class="bar-fill" style="width:${Math.min(
          100,
          i.pct
        )}%"></div>${
        allItem
          ? `<div class="bar-fill is-all" style="width:${Math.min(
              100,
              allItem.pct
            )}%"></div>`
          : ""
      }</div>
      </div>`;
    })
    .join("")}</div>`;
}

/* ---------- image_pick ---------- */

// Ranked tile thumbnails. Zero-pick tiles stay in the list at the bottom:
// "nobody chose any of the illustrative ones" is a real finding.
function tileList(agg, aAll, opts = {}) {
  const tiles = agg.stats.tiles || [];
  if (!agg.n || !tiles.length)
    return emptyBlock("Nobody in this segment picked any of these.");
  const items = opts.limit ? tiles.slice(0, opts.limit) : tiles;
  const compare = comparing() && aAll && aAll.n;
  const allTiles = compare ? aAll.stats.tiles || [] : [];
  const maxPct = Math.max(
    1,
    ...items.map((i) => i.pct),
    ...(compare ? allTiles.map((i) => i.pct) : [0])
  );
  const cells = items
    .map((i) => {
      const allItem = compare ? allTiles.find((x) => x.id === i.id) : null;
      const w = (i.pct / maxPct) * 100;
      const wAll = allItem ? (allItem.pct / maxPct) * 100 : 0;
      return `<li class="tile ${i.count ? "" : "is-zero"}">
        <div class="tile-thumb">${
          i.extra.img
            ? `<img src="${esc(i.extra.img)}" alt="" loading="lazy" />`
            : '<span class="tile-noimg"></span>'
        }</div>
        <div class="tile-bar">
          <div class="bar-fill" style="width:${w}%"></div>
          ${compare ? `<div class="bar-fill is-all" style="width:${wAll}%"></div>` : ""}
        </div>
        <div class="tile-meta">
          <span class="tile-count">${i.count}</span>
          <span class="tile-pct">${Math.round(i.pct)}%</span>
          ${
            compare
              ? `<span class="tile-allpct">all ${
                  allItem ? Math.round(allItem.pct) : 0
                }%</span>`
              : ""
          }
        </div>
      </li>`;
    })
    .join("");
  return `<ol class="tiles ${opts.sheet ? "is-sheet" : ""}">${cells}</ol>`;
}

function familyDenomNote(agg) {
  if (!agg.n) return "";
  const person = agg.n === 1 ? "person" : "people";
  return `<p class="chart-note">Percentages are out of the ${agg.n} ${person} in this view who answered. Someone who picked two tiles from one family counts once for that family, and a tile that sits in two families counts for both.</p>`;
}

function imagePickBlocks(q, aSeg, aAll) {
  const title = questionTitle(q);
  const blocks = [];

  if (aSeg.stats.hasFamilies) {
    const famSeg = { ...aSeg, items: aSeg.stats.families };
    const famAll = aAll ? { ...aAll, items: aAll.stats.families } : null;
    blocks.push(`<section class="card chart-card">
      <header class="chart-head">
        <h3 class="chart-title">Style families, ranked</h3>
        <span class="chart-n">${aSeg.n} answered</span>
      </header>
      ${
        aSeg.n
          ? barList(famSeg, famAll) + familyDenomNote(aSeg)
          : emptyBlock("Nobody in this segment answered this one.")
      }
    </section>`);
  }

  blocks.push(`<section class="card chart-card">
    <header class="chart-head">
      <h3 class="chart-title">${esc(
        aSeg.stats.hasFamilies ? "Individual tiles, ranked" : title
      )}</h3>
      <span class="chart-n">${aSeg.n} answered</span>
    </header>
    ${tileList(aSeg, aAll)}
    ${
      aSeg.n
        ? `<p class="chart-note">Sorted by how many people picked each one. Tiles nobody picked sit at the bottom.</p>`
        : ""
    }
  </section>`);

  return blocks.join("");
}

function ratingChart(q, agg, aAll) {
  if (!agg.n) return emptyBlock("Nobody in this segment answered this one.");
  const compare = comparing() && aAll && aAll.n;
  const maxCount = Math.max(1, ...agg.items.map((i) => i.count));
  const allMax = compare ? Math.max(1, ...aAll.items.map((x) => x.count)) : 1;
  const cols = agg.items
    .map((i) => {
      const allItem = compare ? aAll.items.find((x) => x.id === i.id) : null;
      return `<div class="rcol">
        <div class="rcol-stack">
          ${
            allItem
              ? `<div class="rcol-fill is-all" style="height:${
                  (allItem.count / allMax) * 100
                }%"></div>`
              : ""
          }
          <div class="rcol-fill" style="height:${(i.count / maxCount) * 100}%"></div>
        </div>
        <div class="rcol-label">${esc(i.label)}</div>
        <div class="rcol-count">${i.count}</div>
      </div>`;
    })
    .join("");
  return `<div class="rating">
    <div class="rating-cols">${cols}</div>
    <div class="rating-ends"><span>${esc(agg.stats.minLabel)}</span><span>${esc(
    agg.stats.maxLabel
  )}</span></div>
    <div class="rating-avg">Average ${esc(fmt(agg.stats.avg))}${
    compare ? ` · everyone ${esc(fmt(aAll.stats.avg))}` : ""
  } · ${agg.n} answered</div>
  </div>`;
}

function personTag(r) {
  const tags = (r.tags || [])
    .map((t) => {
      const d = tagDef(t);
      return `<span class="tagchip tagchip-static" style="--chip:${esc(
        d.color
      )}">${esc(d.label)}</span>`;
    })
    .join("");
  return `<span class="quote-who">${esc(r.role || "No area given")}${
    r.tenure ? ` · ${esc(r.tenure)}` : ""
  }</span>${tags}`;
}

function quoteCards(agg, opts = {}) {
  const term = (state.quoteSearch || "").trim().toLowerCase();
  let items = agg.items;
  if (term && !opts.noSearch) {
    items = items.filter((i) => {
      const p = i.extra.person || {};
      return (
        i.label.toLowerCase().includes(term) ||
        String(p.role || "").toLowerCase().includes(term) ||
        String(p.name || "").toLowerCase().includes(term)
      );
    });
  }
  if (!items.length)
    return emptyBlock(
      term && !opts.noSearch
        ? "No answers match that search."
        : "No written answers in this segment."
    );
  return `<div class="quotes">${items
    .map(
      (i) => `<figure class="quote">
      <blockquote>${
        opts.prefix ? `<span class="quote-prefix">${esc(opts.prefix)}</span> ` : ""
      }${esc(i.label)}</blockquote>
      <figcaption>${personTag(i.extra.person || {})}</figcaption>
    </figure>`
    )
    .join("")}</div>`;
}

function repeaterList(agg) {
  if (!agg.items.length) return emptyBlock("Nothing listed inside this segment.");
  return `<div class="reps">${agg.items
    .map((i) => {
      const urlNote = i.extra.notes.find(
        (n) => (n.field && n.field.type === "url") || isUrl(n.value)
      );
      let head;
      if (safeHref(i.label)) {
        head = linkify(i.label);
      } else if (urlNote && safeHref(urlNote.value)) {
        head = `<a href="${safeHref(
          urlNote.value
        )}" target="_blank" rel="noopener noreferrer">${esc(i.label)}</a>`;
      } else {
        head = esc(i.label);
      }
      const notes = i.extra.notes
        .filter((n) => n !== urlNote && !isUrl(n.value))
        .map(
          (n) =>
            `<li><span class="rep-note-who">${esc(
              n.person.role || "Someone"
            )}</span> ${esc(n.value)}</li>`
        )
        .join("");
      return `<div class="rep">
        <div class="rep-head"><strong>${head}</strong><span class="rep-count">${
        i.count
      } ${i.count === 1 ? "mention" : "mentions"}</span></div>
        ${notes ? `<ul class="rep-notes">${notes}</ul>` : ""}
      </div>`;
    })
    .join("")}</div>`;
}

/* ------------------------------------------------------------------ *
 * Filter bar rendering
 * ------------------------------------------------------------------ */

function countLabel() {
  const seg = segment();
  return `Showing <strong>${seg.length}</strong> of ${
    state.respondents.length
  }<span class="filter-count-name">${esc(segmentName())}</span>`;
}

function renderFilterBar() {
  const f = state.filters;

  const buttons = [{ id: "all", label: "All" }]
    .concat(tagDefs().map((t) => ({ id: t.id, label: t.label, color: t.color })))
    .concat([{ id: "custom", label: "Custom" }]);

  setHTML(
    $("#segment-buttons"),
    buttons
      .map((b) => {
        const count =
          b.id === "all"
            ? state.respondents.length
            : b.id === "custom"
            ? f.custom.size
            : state.respondents.filter((r) => (r.tags || []).includes(b.id))
                .length;
        return `<button type="button" class="segbtn ${
          f.segment === b.id ? "is-active" : ""
        }" data-seg="${esc(b.id)}"${
          b.color ? ` style="--seg:${esc(b.color)}"` : ""
        }>${esc(b.label)}<span class="segbtn-n">${count}</span></button>`;
      })
      .join("")
  );

  fillSelect("#filter-role", "All roles", uniqueValues("role"), f.role);
  fillSelect("#filter-tenure", "All tenures", uniqueValues("tenure"), f.tenure);

  $("#filter-compare").checked = f.compare;
  $("#custom-picker").hidden = f.segment !== "custom";
  if (f.segment === "custom") renderPicker();

  setHTML($("#filter-count"), countLabel());
}

function uniqueValues(field) {
  const set = new Set();
  for (const r of state.respondents) {
    const v = String(r[field] || "").trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function fillSelect(sel, allLabel, values, current) {
  const el = $(sel);
  setHTML(
    el,
    `<option value="">${esc(allLabel)}</option>` +
      values
        .map(
          (v) =>
            `<option value="${esc(v)}"${v === current ? " selected" : ""}>${esc(
              v
            )}</option>`
        )
        .join("")
  );
  el.value = current || "";
}

function renderPicker() {
  const term = state.pickerSearch.trim().toLowerCase();
  const list = state.respondents.filter((r) => {
    if (!term) return true;
    return `${r.name} ${r.email} ${r.role} ${r.tenure}`
      .toLowerCase()
      .includes(term);
  });
  const wrap = $("#picker-list");
  if (!list.length) {
    setHTML(wrap, emptyBlock("Nobody matches that search."));
  } else {
    setHTML(
      wrap,
      list
        .map(
          (r) => `<label class="picker-item">
        <input type="checkbox" data-pick="${esc(r.id)}"${
            state.filters.custom.has(r.id) ? " checked" : ""
          } />
        <span class="picker-name">${esc(r.name || "(no name)")}</span>
        <span class="picker-meta">${esc(r.role || "")}</span>
        <span class="picker-tags">${(r.tags || [])
          .map((t) => {
            const d = tagDef(t);
            return `<span class="tagchip tagchip-static" style="--chip:${esc(
              d.color
            )}">${esc(d.label)}</span>`;
          })
          .join("")}</span>
      </label>`
        )
        .join("")
    );
  }
  $("#picker-count").textContent = `${state.filters.custom.size} selected`;
}

/* ------------------------------------------------------------------ *
 * View: Responses
 * ------------------------------------------------------------------ */

function sortedRespondents() {
  const { key, dir } = state.sort;
  const list = state.respondents.slice();
  list.sort((a, b) => {
    let va = key === "tags" ? (a.tags || []).join(",") : a[key];
    let vb = key === "tags" ? (b.tags || []).join(",") : b[key];
    va = String(va == null ? "" : va).toLowerCase();
    vb = String(vb == null ? "" : vb).toLowerCase();
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });
  return list;
}

function renderResponses() {
  const people = sortedRespondents();
  const inSeg = new Set(segment().map((r) => r.id));

  const cols = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    { key: "tenure", label: "Tenure" },
    { key: "submitted_at", label: "Submitted" },
    { key: "tags", label: "Tags" },
  ];

  const head = cols
    .map(
      (c) =>
        `<th><button type="button" class="th-sort ${
          state.sort.key === c.key ? "is-sorted" : ""
        }" data-sort="${esc(c.key)}">${esc(c.label)}<span class="th-arrow">${
          state.sort.key === c.key ? (state.sort.dir === "asc" ? "▲" : "▼") : ""
        }</span></button></th>`
    )
    .join("");

  const rows = people.length
    ? people
        .map(
          (r) => `<tr class="${inSeg.has(r.id) ? "in-seg" : "out-seg"}">
        <td class="td-name">${esc(r.name || "(no name)")}</td>
        <td class="td-email">${esc(r.email || "")}</td>
        <td>${esc(r.role || "")}</td>
        <td>${esc(r.tenure || "")}</td>
        <td class="td-date">${esc(fmtDate(r.submitted_at))}</td>
        <td class="td-tags">${tagDefs()
          .map((t) => {
            const on = (r.tags || []).includes(t.id);
            return `<button type="button" class="tagchip ${
              on ? "is-on" : ""
            }" style="--chip:${esc(t.color)}" data-tag="${esc(
              t.id
            )}" data-id="${esc(r.id)}" title="Click to toggle">${esc(
              t.label
            )}</button>`;
          })
          .join("")}</td>
        <td class="td-actions">${
          state.role === "client"
            ? ""
            : `<button type="button" class="btn btn-danger btn-sm" data-delete="${esc(r.id)}">Delete</button>`
        }</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="7">${emptyBlock(
        "No responses yet. This table fills in as people submit."
      )}</td></tr>`;

  return `
  <div class="stack">
    <section class="card">
      <header class="card-head">
        <h2 class="card-title">Everyone who responded</h2>
        <p class="card-sub">${state.respondents.length} total. ${
    segment().length
  } inside the active segment. Rows outside the segment are dimmed.</p>
      </header>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>${head}<th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <header class="card-head">
        <h2 class="card-title">Who has not responded</h2>
        <p class="card-sub">Paste the expected roster of emails, one per line or comma separated.</p>
      </header>
      <div class="roster">
        <textarea id="roster-input" class="roster-input" rows="8" placeholder="someone@example.org&#10;another@example.org"></textarea>
        <div class="roster-out" id="roster-out">${renderRosterDiff()}</div>
      </div>
    </section>
  </div>`;
}

function parseRoster(text) {
  return Array.from(
    new Set(
      String(text || "")
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes("@"))
    )
  );
}

function renderRosterDiff() {
  const expected = parseRoster(state.roster);
  if (!expected.length) {
    return `<div class="roster-empty">Paste a list to see who is missing.</div>`;
  }
  const have = new Set(
    state.respondents.map((r) => String(r.email || "").trim().toLowerCase())
  );
  const missing = expected.filter((e) => !have.has(e));
  const extra = Array.from(have).filter((e) => e && !expected.includes(e));
  return `
    <div class="roster-stats">
      <span><strong>${expected.length}</strong> expected</span>
      <span><strong>${expected.length - missing.length}</strong> responded</span>
      <span class="is-alert-text"><strong>${
        missing.length
      }</strong> missing</span>
    </div>
    ${
      missing.length
        ? `<textarea id="roster-missing" class="roster-input is-out" rows="6" readonly>${esc(
            missing.join(", ")
          )}</textarea>
        <button type="button" class="btn btn-primary btn-sm" id="btn-copy-missing">Copy missing emails</button>`
        : `<div class="roster-empty">Everyone on the list has responded.</div>`
    }
    ${
      extra.length
        ? `<details class="roster-extra"><summary>${
            extra.length
          } responded but are not on the list</summary><p>${esc(
            extra.join(", ")
          )}</p></details>`
        : ""
    }`;
}

/* ------------------------------------------------------------------ *
 * View: Results
 * ------------------------------------------------------------------ */

function wrapEmpty(title, body) {
  return `<section class="card empty-card">
    <h2 class="card-title">${esc(title)}</h2>
    <p class="card-sub">${esc(body)}</p>
  </section>`;
}

function renderResults() {
  const seg = segment();
  const all = everyone();
  if (!state.respondents.length) {
    return `<div class="stack">${wrapEmpty(
      "No responses yet",
      "Charts appear here as soon as the first person submits."
    )}</div>`;
  }
  if (!seg.length) {
    return `<div class="stack">${wrapEmpty(
      "This segment has nobody in it",
      "Change the segment, role, or tenure filter to see results."
    )}</div>`;
  }

  const sections = (state.config.sections || []).filter((s) =>
    (s.questions || []).some((q) => !IDENTITY_TYPES.has(q.type))
  );

  const blocks = sections.map((s) => {
    const qs = (s.questions || []).filter((q) => !IDENTITY_TYPES.has(q.type));
    const inner = qs
      .map((q) => renderQuestion(q, summarize(q, seg), summarize(q, all)))
      .join("");
    return `<section class="qsection">
      <header class="qsection-head">
        <h2 class="qsection-title">${esc(s.title || s.id)}</h2>
        ${s.blurb ? `<p class="qsection-blurb">${esc(s.blurb)}</p>` : ""}
      </header>
      ${inner}
    </section>`;
  });

  return `<div class="stack">
    ${legendRow()}
    <div class="results-tools">
      <input id="quote-search" class="filter-input" type="search" placeholder="Search written answers" value="${esc(
        state.quoteSearch
      )}" />
      <span class="results-tools-note">Filters the quote cards below.</span>
    </div>
    ${blocks.join("")}
  </div>`;
}

function renderQuestion(q, aSeg, aAll) {
  if (q.type === "slider_pair") return dumbbell(q, aSeg, aAll);
  if (q.type === "ab_pair") return splitBar(q, aSeg, aAll);
  if (q.type === "image_pick") return imagePickBlocks(q, aSeg, aAll);

  let body = "";
  if (q.type === "wordbank") {
    body = barList(aSeg, aAll, { alert: aSeg.stats.negative, limit: 30 });
  } else if (q.type === "multi_select") {
    body = barList(aSeg, aAll);
  } else if (q.type === "palette_grid") {
    body = paletteList(aSeg, aAll);
  } else if (q.type === "rating") {
    body = ratingChart(q, aSeg, aAll);
  } else if (q.type === "repeater") {
    body = repeaterList(aSeg);
  } else if (OPEN_TEXT_TYPES.has(q.type)) {
    body = quoteCards(aSeg, { prefix: q.type === "sentence" ? q.prefix : "" });
  } else {
    body = emptyBlock("No renderer for this question type.");
  }

  return `<section class="card chart-card ${
    q.type === "wordbank" && aSeg.stats.negative ? "is-alert-card" : ""
  }">
    <header class="chart-head">
      <h3 class="chart-title">${esc(questionTitle(q))}</h3>
      <span class="chart-n">${aSeg.n} answered</span>
    </header>
    ${body}
  </section>`;
}

/* ------------------------------------------------------------------ *
 * View: Consensus
 * ------------------------------------------------------------------ */

function renderConsensus() {
  const seg = segment();
  if (!state.respondents.length) {
    return `<div class="stack">${wrapEmpty(
      "No responses yet",
      "Agreement scores need at least one submission."
    )}</div>`;
  }
  if (!seg.length) {
    return `<div class="stack">${wrapEmpty(
      "This segment has nobody in it",
      "Change the filters to score a group that has answers."
    )}</div>`;
  }

  const scored = [];
  for (const q of allQuestions()) {
    if (!SCORED_TYPES.has(q.type)) continue;
    const agg = summarize(q, seg);
    const score = consensusScore(q, agg);
    if (score == null) continue;
    scored.push({ q, agg, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const settled = scored.filter((s) => s.score >= 70);
  const leaning = scored.filter((s) => s.score >= 45 && s.score < 70);
  const discuss = scored.filter((s) => s.score < 45);
  const divs = divergences();

  const divBlock = isFiltered()
    ? `<section class="card diverge-card">
        <header class="card-head">
          <h2 class="card-title">Segment diverges from everyone</h2>
          <p class="card-sub">Where <strong>${esc(
            segmentName()
          )}</strong> lands somewhere different from the full group. This is the agenda for the results call.</p>
        </header>
        ${
          divs.length
            ? `<ul class="diverge-list">${divs
                .map(
                  (d) => `<li class="diverge-item">
                  <div class="diverge-q">${esc(questionTitle(d.q))}</div>
                  <div class="diverge-detail">${esc(d.detail)}</div>
                </li>`
                )
                .join("")}</ul>`
            : emptyBlock(
                "The segment and the full group agree on every scored question."
              )
        }
      </section>`
    : `<section class="card">
        <header class="card-head">
          <h2 class="card-title">Segment diverges from everyone</h2>
          <p class="card-sub">Pick a segment above to see where that group parts ways with the full group.</p>
        </header>
      </section>`;

  return `<div class="stack">
    ${divBlock}
    ${consensusColumn(
      "Settled",
      settled,
      "settled",
      "Score 70 and up. Treat these as decided."
    )}
    ${consensusColumn(
      "Leaning",
      leaning,
      "leaning",
      "Score 45 to 69. A direction is forming."
    )}
    ${consensusColumn(
      "Needs discussion",
      discuss,
      "discuss",
      "Score under 45. The room is split."
    )}
  </div>`;
}

function consensusColumn(title, list, band, sub) {
  return `<section class="card cons-card is-${esc(band)}">
    <header class="card-head">
      <h2 class="card-title">${esc(title)} <span class="cons-count">${
    list.length
  }</span></h2>
      <p class="card-sub">${esc(sub)}</p>
    </header>
    ${
      list.length
        ? `<ul class="cons-list">${list
            .map((s) => {
              const top = s.agg.items.filter((i) => i.count > 0)[0];
              const detail =
                s.q.type === "slider_pair"
                  ? `Should be ${fmt(s.agg.stats.desAvg)} on the ${
                      s.q.left || ""
                    } to ${s.q.right || ""} track`
                  : s.q.type === "rating"
                  ? `Average ${fmt(s.agg.stats.avg)}`
                  : top
                  ? `Top answer: ${top.label} (${Math.round(top.pct)}%)`
                  : "";
              return `<li class="cons-item">
                <div class="cons-meter"><div class="cons-fill" style="width:${Math.round(
                  s.score
                )}%"></div></div>
                <div class="cons-body">
                  <div class="cons-q">${esc(questionTitle(s.q))}</div>
                  <div class="cons-detail">${esc(detail)}</div>
                </div>
                <div class="cons-score">${Math.round(s.score)}</div>
              </li>`;
            })
            .join("")}</ul>`
        : emptyBlock("Nothing lands in this band.")
    }
  </section>`;
}

/* ------------------------------------------------------------------ *
 * View: Report
 * ------------------------------------------------------------------ */

function reportBlock(title, inner, note) {
  if (!inner) return "";
  return `<section class="rep-section">
    <h2 class="rep-title">${esc(title)}</h2>
    ${note ? `<p class="rep-note">${esc(note)}</p>` : ""}
    ${inner}
  </section>`;
}

function renderReport() {
  const seg = segment();
  const all = everyone();
  const client = (state.config && state.config.client) || {};
  const intro = (state.config && state.config.intro) || {};

  const cover = `<section class="rep-cover">
    ${client.logo ? `<img class="rep-logo" src="${esc(client.logo)}" alt="" />` : ""}
    <p class="rep-eyebrow">${esc(intro.eyebrow || "Brand Assessment")}</p>
    ${
      client.logo && client.logoIncludesName
        ? ""
        : `<h1 class="rep-client">${esc(client.name || "")}</h1>`
    }
    <div class="rep-facts">
      <div><span class="rep-fact-n">${
        all.length
      }</span><span class="rep-fact-l">total responses</span></div>
      <div><span class="rep-fact-n">${
        seg.length
      }</span><span class="rep-fact-l">in this view</span></div>
    </div>
    <p class="rep-segment">Segment: <strong>${esc(segmentName())}</strong></p>
    <p class="rep-by">Prepared by ${esc(client.agency || "")} · ${esc(
    fmtDate(new Date().toISOString())
  )}</p>
  </section>`;

  if (!seg.length) {
    return `<div class="report">${cover}${wrapEmpty(
      "Nothing to report for this segment",
      "Change the filters and print again."
    )}</div>`;
  }

  const sliders = questionsOfType("slider_pair");
  const sliderBlock = sliders.length
    ? reportBlock(
        "Where we are and where we should be",
        `<div class="rep-dumbbells">${sliders
          .map((q) => dumbbell(q, summarize(q, seg), summarize(q, all)))
          .join("")}</div>`
      )
    : "";

  const wordBlock = questionsOfType("wordbank")
    .map((q) => {
      const agg = summarize(q, seg);
      return reportBlock(
        questionTitle(q),
        `<div class="${agg.stats.negative ? "is-alert-card" : ""}">${barList(
          agg,
          summarize(q, all),
          { alert: agg.stats.negative, limit: 12 }
        )}</div>`
      );
    })
    .join("");

  const abQs = questionsOfType("ab_pair");
  const abBlock = abQs.length
    ? reportBlock(
        "This or that",
        `<div class="rep-abs">${abQs
          .map((q) => splitBar(q, summarize(q, seg), summarize(q, all)))
          .join("")}</div>`
      )
    : "";

  // Style picks sit right after the A/B splits: the family ranking, then a
  // small contact sheet of the six most picked tiles.
  const picksBlock = questionsOfType("image_pick")
    .map((q) => {
      const agg = summarize(q, seg);
      const aAll = summarize(q, all);
      if (!agg.n) return "";
      const fams = agg.stats.hasFamilies
        ? barList(
            { ...agg, items: agg.stats.families },
            { ...aAll, items: aAll.stats.families },
            { limit: 8 }
          ) + familyDenomNote(agg)
        : "";
      const sheet = tileList(agg, aAll, { limit: 6, sheet: true });
      return reportBlock(
        agg.stats.hasFamilies ? "Style families" : questionTitle(q),
        `${fams}<div class="rep-sheet-head">Most picked tiles</div>${sheet}`
      );
    })
    .join("");

  const palBlock = questionsOfType("palette_grid")
    .map((q) => {
      const agg = summarize(q, seg);
      return reportBlock(
        "Winning palettes",
        paletteList({ ...agg, items: agg.items.slice(0, 6) }, summarize(q, all))
      );
    })
    .join("");

  const msBlock = questionsOfType("multi_select")
    .map((q) =>
      reportBlock(questionTitle(q), barList(summarize(q, seg), summarize(q, all)))
    )
    .join("");

  const ratingBlock = questionsOfType("rating")
    .map((q) =>
      reportBlock(
        questionTitle(q),
        ratingChart(q, summarize(q, seg), summarize(q, all))
      )
    )
    .join("");

  const textBlock = allQuestions()
    .filter((q) => q.type === "textarea" || q.type === "text")
    .map((q) =>
      reportBlock(questionTitle(q), quoteCards(summarize(q, seg), { noSearch: true }))
    )
    .join("");

  const repBlock = questionsOfType("repeater")
    .map((q) => reportBlock(questionTitle(q), repeaterList(summarize(q, seg))))
    .join("");

  const sentenceBlock = questionsOfType("sentence")
    .map((q) =>
      reportBlock(
        questionTitle(q),
        quoteCards(summarize(q, seg), { noSearch: true, prefix: q.prefix })
      )
    )
    .join("");

  return `<div class="report">
    ${cover}
    ${sliderBlock}
    ${wordBlock}
    ${abBlock}
    ${picksBlock}
    ${palBlock}
    ${msBlock}
    ${ratingBlock}
    ${textBlock}
    ${repBlock}
    ${sentenceBlock}
  </div>`;
}

/* ------------------------------------------------------------------ *
 * Render dispatch
 * ------------------------------------------------------------------ */

function viewMarkup() {
  if (state.view === "responses") return renderResponses();
  if (state.view === "results") return renderResults();
  if (state.view === "consensus") return renderConsensus();
  return renderReport();
}

function renderCurrentViewOnly() {
  const view = $("#view");
  view.classList.toggle("is-report", state.view === "report");
  setHTML(view, viewMarkup());
  const roster = $("#roster-input");
  if (roster) roster.value = state.roster;
}

function render() {
  renderFilterBar();
  $$("#tabs .tab").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.view === state.view)
  );
  renderCurrentViewOnly();
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

async function saveTags(id, tags) {
  const person = state.respondents.find((r) => r.id === id);
  if (!person) return;
  const before = person.tags.slice();
  person.tags = tags;
  render();
  try {
    await api("/api/admin/respondent", {
      method: "POST",
      body: JSON.stringify({ id, tags, admin_note: person.admin_note || "" }),
    });
    toast("Tags saved");
  } catch (e) {
    person.tags = before;
    render();
    if (e.status === 401) return showGate("Session expired. Sign in again.");
    toast("Could not save tags", true);
  }
}

async function deleteRespondent(id) {
  const person = state.respondents.find((r) => r.id === id);
  if (!person) return;
  const ok = window.confirm(
    `Delete the response from ${
      person.name || person.email || "this person"
    }? This cannot be undone.`
  );
  if (!ok) return;
  try {
    await api("/api/admin/respondent", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    state.respondents = state.respondents.filter((r) => r.id !== id);
    state.filters.custom.delete(id);
    render();
    toast("Response deleted");
  } catch (e) {
    if (e.status === 401) return showGate("Session expired. Sign in again.");
    toast("Could not delete", true);
  }
}

async function refresh() {
  try {
    await loadData();
    render();
    toast("Data refreshed");
  } catch (e) {
    if (e.status === 401) return showGate("Session expired. Sign in again.");
    toast("Could not load data", true);
  }
}

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

function wire() {
  $("#gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("#gate-pw").value;
    const btn = $("#gate-submit");
    btn.disabled = true;
    try {
      // Only auth and network failures belong on the gate. Anything that goes
      // wrong after we are signed in must not masquerade as a bad password.
      await tryPassword(pw);
    } catch (err) {
      showGate(
        err.status === 401
          ? "That password did not work. Try again."
          : "Could not reach the server. Try again."
      );
      btn.disabled = false;
      return;
    }
    btn.disabled = false;
    $("#gate").hidden = true;
    $("#app").hidden = false;
    try {
      await loadData();
      render();
    } catch (err) {
      console.error("Dashboard failed to render", err);
      toast("Signed in, but something failed to draw. See the console.", true);
    }
  });

  $("#btn-refresh").addEventListener("click", refresh);
  $("#btn-signout").addEventListener("click", signOut);
  $("#btn-print").addEventListener("click", () => {
    state.view = "report";
    render();
    setTimeout(() => window.print(), 60);
  });

  $("#btn-reset").addEventListener("click", () => {
    state.filters.segment = "all";
    state.filters.role = "";
    state.filters.tenure = "";
    state.filters.compare = false;
    render();
  });

  $("#segment-buttons").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-seg]");
    if (!btn) return;
    state.filters.segment = btn.dataset.seg;
    render();
  });

  $("#filter-role").addEventListener("change", (e) => {
    state.filters.role = e.target.value;
    render();
  });
  $("#filter-tenure").addEventListener("change", (e) => {
    state.filters.tenure = e.target.value;
    render();
  });
  $("#filter-compare").addEventListener("change", (e) => {
    state.filters.compare = e.target.checked;
    render();
  });

  $("#picker-search").addEventListener("input", (e) => {
    state.pickerSearch = e.target.value;
    renderPicker();
  });

  $("#custom-picker").addEventListener("click", (e) => {
    const act = e.target.closest("[data-picker]");
    if (!act) return;
    if (act.dataset.picker === "all") {
      $$("#picker-list [data-pick]").forEach((i) =>
        state.filters.custom.add(i.dataset.pick)
      );
    } else {
      state.filters.custom.clear();
    }
    render();
  });

  $("#picker-list").addEventListener("change", (e) => {
    const box = e.target.closest("[data-pick]");
    if (!box) return;
    if (box.checked) state.filters.custom.add(box.dataset.pick);
    else state.filters.custom.delete(box.dataset.pick);
    // Keep the picker's scroll position, refresh the counts and the view.
    $("#picker-count").textContent = `${state.filters.custom.size} selected`;
    setHTML($("#filter-count"), countLabel());
    const customN = $('#segment-buttons [data-seg="custom"] .segbtn-n');
    if (customN) customN.textContent = String(state.filters.custom.size);
    renderCurrentViewOnly();
  });

  $("#tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-view]");
    if (!tab) return;
    state.view = tab.dataset.view;
    render();
  });

  const view = $("#view");

  view.addEventListener("click", (e) => {
    const tagBtn = e.target.closest("[data-tag][data-id]");
    if (tagBtn) {
      const id = tagBtn.dataset.id;
      const tag = tagBtn.dataset.tag;
      const person = state.respondents.find((r) => r.id === id);
      if (!person) return;
      const next = person.tags.includes(tag)
        ? person.tags.filter((t) => t !== tag)
        : person.tags.concat([tag]);
      saveTags(id, next);
      return;
    }

    const del = e.target.closest("[data-delete]");
    if (del) {
      deleteRespondent(del.dataset.delete);
      return;
    }

    const sortBtn = e.target.closest("[data-sort]");
    if (sortBtn) {
      const key = sortBtn.dataset.sort;
      if (state.sort.key === key) {
        state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
      } else {
        state.sort.key = key;
        state.sort.dir = "asc";
      }
      render();
      return;
    }

    if (e.target.id === "btn-copy-missing") {
      const box = $("#roster-missing");
      if (!box) return;
      box.select();
      navigator.clipboard
        .writeText(box.value)
        .then(() => toast("Copied"))
        .catch(() => toast("Select and copy by hand", true));
    }
  });

  view.addEventListener("input", (e) => {
    if (e.target.id === "quote-search") {
      state.quoteSearch = e.target.value;
      const pos = e.target.selectionStart;
      renderCurrentViewOnly();
      const again = $("#quote-search");
      if (again) {
        again.focus();
        again.setSelectionRange(pos, pos);
      }
    }
    if (e.target.id === "roster-input") {
      state.roster = e.target.value;
      setHTML($("#roster-out"), renderRosterDiff());
    }
  });
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

function applyTheme() {
  const t = (state.config && state.config.theme) || {};
  const root = document.documentElement;
  const set = (name, val) => {
    if (val) root.style.setProperty(name, val);
  };
  set("--ink", t.ink);
  set("--accent", t.accent);
  set("--support", t.support);
  set("--paper", t.paper);
  set("--soft", t.soft);
  if (t.alert) set("--alert", t.alert);
  else {
    const veto = tagDefs().find((x) => /veto/i.test(x.id));
    if (veto && veto.color) set("--alert", veto.color);
  }
}

function applyBranding() {
  const c = (state.config && state.config.client) || {};
  const intro = (state.config && state.config.intro) || {};
  document.title = `${c.name || "Brand"} assessment dashboard`;
  const eyebrow = intro.eyebrow || "Brand Assessment";
  $("#gate-eyebrow").textContent = eyebrow;
  $("#topbar-eyebrow").textContent = eyebrow;
  const titleEl = $("#topbar-title");
  const fallbackTitle = c.name || "Dashboard";
  // The logo art may already carry the wordmark. Do not print the name twice.
  titleEl.textContent = c.logo && c.logoIncludesName ? "" : fallbackTitle;
  if (c.logo) {
    const img = $("#brand-logo");
    img.addEventListener("error", () => {
      img.hidden = true;
      titleEl.textContent = fallbackTitle;
    });
    img.src = c.logo;
    img.hidden = false;
  }
}

async function boot() {
  try {
    const res = await fetch("/client.config.json", { cache: "no-store" });
    state.config = await res.json();
  } catch {
    const gate = $("#gate");
    gate.hidden = false;
    $("#gate-error").textContent = "Could not load client.config.json.";
    $("#gate-error").hidden = false;
    return;
  }

  state.storageKey = `ba-admin-pw:${
    (state.config.client && state.config.client.slug) || "default"
  }`;

  applyTheme();
  applyBranding();
  wire();

  const saved = sessionStorage.getItem(state.storageKey);
  if (saved) {
    try {
      await tryPassword(saved);
      $("#gate").hidden = true;
      $("#app").hidden = false;
      await loadData();
      render();
      return;
    } catch {
      sessionStorage.removeItem(state.storageKey);
    }
  }
  showGate("");
}

boot();
