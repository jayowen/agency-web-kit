/* ==========================================================================
   Brand Assessment - survey engine

   Everything here renders from /client.config.json. No question, word, color,
   role, or client name is written into this file. Adding a question to the
   config renders it with no code change.
   ========================================================================== */

const CONFIG_URL = "/client.config.json";
const SUBMIT_URL = "/api/submit";
const ALERT_FALLBACK = "#b4462f";
const IDENTITY_TYPES = new Set([
  "identity_name",
  "identity_email",
  "identity_select",
]);

/* --------------------------------------------------------------------------
   State
   -------------------------------------------------------------------------- */

let config = null;
let storageKey = "";

let state = {
  sectionIndex: 0,
  respondent: {},
  answers: {},
  order: {}, // sectionId -> [question key]
  flips: {}, // ab_pair question key -> true when the b option renders first
  tileOrder: {}, // image_pick question key -> [tile id] shuffled once per session
};

let errors = {}; // question key -> message
let showErrors = false;
let submitting = false;
let pendingNotice = null;
const questionNodes = new Map(); // question key -> DOM node

/* --------------------------------------------------------------------------
   Tiny DOM helpers
   -------------------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "style") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, String(v));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

const str = (v) => (typeof v === "string" ? v.trim() : "");

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

init();

async function init() {
  try {
    const res = await fetch(CONFIG_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("config " + res.status);
    config = await res.json();
  } catch (err) {
    $("view").replaceChildren(
      el("div", { class: "survey-notice" }, [
        el("h3", { text: "We could not load the questions." }),
        el("p", {
          text: "Please refresh the page. If it keeps happening, let the person who sent you this link know.",
        }),
      ])
    );
    return;
  }

  applyTheme(config.theme || {});
  buildBrandBar();
  buildDeadlineBanner();

  restoreDraft();
  ensureOrderAndFlips();

  $("btn-back").addEventListener("click", goBack);
  $("btn-next").addEventListener("click", goNext);

  goTo(clampIndex(state.sectionIndex), { scroll: false });
}

/* --------------------------------------------------------------------------
   Theme, brand bar, deadline
   -------------------------------------------------------------------------- */

function applyTheme(theme) {
  const root = document.documentElement;
  for (const key of ["ink", "accent", "support", "paper", "soft"]) {
    if (theme[key]) root.style.setProperty("--" + key, theme[key]);
  }

  const vetoTag = (config.admin?.tags || []).find((t) => t.id === "veto");
  root.style.setProperty("--alert", theme.alert || vetoTag?.color || ALERT_FALLBACK);

  if (theme.paper) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = theme.paper;
    document.head.appendChild(meta);
  }
}

function buildBrandBar() {
  const client = config.client || {};
  const logo = $("brand-logo");
  const nameEl = $("brand-name");
  const fallbackName = client.shortName || client.name || "";
  // When the logo art already contains the wordmark, showing the name beside it
  // reads as a duplicate. Set client.logoIncludesName to drop the text.
  const hideName = Boolean(client.logo && client.logoIncludesName);
  nameEl.textContent = hideName ? "" : fallbackName;
  if (client.logo) {
    logo.src = client.logo;
    logo.alt = client.name ? client.name + " logo" : "";
    logo.classList.remove("hidden");
    logo.addEventListener("error", () => {
      logo.classList.add("hidden");
      nameEl.textContent = fallbackName; // never end up with no brand at all
    });
  }
  $("brand-agency").textContent = client.agency ? "with " + client.agency : "";
  if (client.name) document.title = client.name + " " + (config.intro?.eyebrow || "Brand Assessment");
  storageKey = "brand-assessment:" + (client.slug || "default") + ":draft";
}

function formatDeadline(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const d = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], 12));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function buildDeadlineBanner() {
  const banner = $("deadline-banner");
  const pretty = formatDeadline(config.deadline);
  if (!pretty) return;

  const closed = new Date(config.deadline).getTime() < Date.now();
  banner.textContent = closed
    ? "This closed on " + pretty + ". You can still send your answers."
    : "Please complete by " + pretty;
  if (config.reviewMode) {
    banner.textContent = "Review mode: nothing is required and nothing is saved · " + banner.textContent;
  }
  banner.classList.toggle("banner-alert", closed);
  banner.classList.remove("hidden");
}

/* --------------------------------------------------------------------------
   Draft storage
   -------------------------------------------------------------------------- */

function saveDraft() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (err) {
    /* Private browsing or a full quota. Not worth interrupting anyone over. */
  }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return;
    const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    state = {
      sectionIndex: Number(saved.sectionIndex) || 0,
      respondent: obj(saved.respondent),
      answers: obj(saved.answers),
      order: obj(saved.order),
      flips: obj(saved.flips),
      tileOrder: obj(saved.tileOrder),
    };
  } catch (err) {
    /* A broken draft should never block the survey. */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(storageKey);
  } catch (err) {
    /* ignore */
  }
}

/* --------------------------------------------------------------------------
   Question order and A/B side flips, stable for the whole session
   -------------------------------------------------------------------------- */

function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function ensureOrderAndFlips() {
  let changed = false;

  for (const section of config.sections || []) {
    const keys = (section.questions || []).map((q) => q.key);
    const saved = state.order[section.id];
    const savedIsValid =
      Array.isArray(saved) &&
      saved.length === keys.length &&
      saved.every((k) => keys.includes(k));

    if (!savedIsValid) {
      state.order[section.id] = section.randomize ? shuffle(keys) : keys;
      changed = true;
    }

    for (const q of section.questions || []) {
      if (q.type === "ab_pair") {
        if (typeof state.flips[q.key] !== "boolean") {
          state.flips[q.key] = section.randomize ? Math.random() < 0.5 : false;
          changed = true;
        }
        continue;
      }

      // image_pick always shuffles, so grid position never nudges a pick. The
      // order is stored in the draft, so Back and Next show the same grid.
      if (q.type === "image_pick") {
        const ids = (q.tiles || []).map((t) => t.id);
        const savedTiles = state.tileOrder[q.key];
        const tilesAreValid =
          Array.isArray(savedTiles) &&
          savedTiles.length === ids.length &&
          savedTiles.every((id) => ids.includes(id));

        if (!tilesAreValid) {
          state.tileOrder[q.key] = shuffle(ids);
          changed = true;
        }
      }
    }
  }

  if (changed) saveDraft();
}

function sectionQuestions(section) {
  const byKey = new Map((section.questions || []).map((q) => [q.key, q]));
  const order = state.order[section.id] || [...byKey.keys()];
  return order.map((k) => byKey.get(k)).filter(Boolean);
}

/* --------------------------------------------------------------------------
   Answer access
   -------------------------------------------------------------------------- */

const isIdentity = (q) => IDENTITY_TYPES.has(q.type);

function getVal(q) {
  return isIdentity(q) ? state.respondent[q.key] : state.answers[q.key];
}

function setVal(q, value) {
  if (isIdentity(q)) state.respondent[q.key] = value;
  else state.answers[q.key] = value;
  saveDraft();
  if (showErrors) refreshError(q);
}

/* --------------------------------------------------------------------------
   Navigation
   -------------------------------------------------------------------------- */

const sectionCount = () => (config.sections || []).length;
const clampIndex = (i) => Math.min(Math.max(0, i | 0), Math.max(0, sectionCount() - 1));

function goTo(index, opts = {}) {
  state.sectionIndex = clampIndex(index);
  saveDraft();
  renderSection();
  updateChrome();
  if (opts.scroll !== false) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("survey-main").focus({ preventScroll: true });
  }
}

function goBack() {
  showErrors = false;
  errors = {};
  if (state.sectionIndex > 0) goTo(state.sectionIndex - 1);
}

function goNext() {
  const section = config.sections[state.sectionIndex];
  if (!validateSection(section)) return;

  showErrors = false;
  errors = {};

  if (state.sectionIndex < sectionCount() - 1) {
    goTo(state.sectionIndex + 1);
  } else {
    submit();
  }
}

function updateChrome() {
  const total = sectionCount();
  const idx = state.sectionIndex;
  const section = config.sections[idx];

  $("survey-head").hidden = false;
  $("survey-foot").hidden = false;

  $("progress-step").textContent = "Section " + (idx + 1) + " of " + total;
  $("progress-title").textContent = section.title || "";

  const pct = Math.round(((idx + 1) / total) * 100);
  $("progress-fill").style.width = pct + "%";
  $("progress-bar").setAttribute("aria-valuenow", String(pct));

  const back = $("btn-back");
  back.disabled = idx === 0;
  back.style.visibility = idx === 0 ? "hidden" : "visible";

  const next = $("btn-next");
  next.disabled = submitting;
  next.textContent = submitting
    ? "Sending…"
    : idx === total - 1
      ? "Send my answers"
      : "Next";
}

/* --------------------------------------------------------------------------
   Section rendering
   -------------------------------------------------------------------------- */

function renderSection() {
  const section = config.sections[state.sectionIndex];
  const view = $("view");
  questionNodes.clear();

  const parts = [];
  if (pendingNotice) {
    parts.push(pendingNotice);
    pendingNotice = null;
  }
  if (state.sectionIndex === 0) parts.push(introBlock());

  parts.push(
    el("div", { class: "survey-section-head" }, [
      el("h2", { text: section.title || "" }),
      section.blurb ? el("p", { class: "survey-section-blurb", text: section.blurb }) : null,
    ])
  );

  for (const q of sectionQuestions(section)) {
    const node = renderQuestion(q);
    questionNodes.set(q.key, node);
    parts.push(node);
  }

  view.replaceChildren(...parts);
}

function introBlock() {
  const intro = config.intro || {};
  const bits = [];
  if (intro.eyebrow) bits.push(el("p", { class: "eyebrow", text: intro.eyebrow }));
  if (intro.headline) bits.push(el("h1", { class: "display", text: intro.headline }));
  if (intro.body) bits.push(el("p", { class: "lede survey-intro-body", text: intro.body }));

  const pills = [];
  if (intro.timeEstimate) pills.push(el("span", { class: "survey-pill", text: intro.timeEstimate }));
  pills.push(el("span", { class: "survey-pill", text: sectionCount() + " short sections" }));
  bits.push(el("div", { class: "survey-meta-row" }, pills));

  if (intro.privacyNote) {
    bits.push(el("p", { class: "survey-privacy", text: intro.privacyNote }));
  }

  return el("div", { class: "survey-intro" }, bits);
}

function renderQuestion(q) {
  const wrap = el("section", { class: "survey-q", "data-key": q.key });

  if (q.label) {
    wrap.appendChild(el("h3", { class: "field-label", id: "lbl-" + q.key, text: q.label }));
  }
  if (q.helper) {
    wrap.appendChild(el("p", { class: "field-helper", text: q.helper }));
  }
  // Optional reference link, e.g. a concept the question asks people to react to.
  if (q.link && q.link.href) {
    wrap.appendChild(
      el("p", { class: "field-link" }, [
        el("a", {
          href: q.link.href,
          target: "_blank",
          rel: "noopener",
          text: (q.link.label || q.link.href) + " ↗",
        }),
      ])
    );
  }

  const builder = builders[q.type];
  wrap.appendChild(
    builder
      ? builder(q)
      : el("p", { class: "muted small", text: "This question type is not supported yet." })
  );

  const err = el("p", { class: "field-error", role: "alert", hidden: true });
  err.dataset.errorFor = q.key;
  wrap.appendChild(err);

  return wrap;
}

function rerenderQuestion(q) {
  const old = questionNodes.get(q.key);
  if (!old || !old.parentNode) return;
  const fresh = renderQuestion(q);
  old.parentNode.replaceChild(fresh, old);
  questionNodes.set(q.key, fresh);
  if (showErrors) refreshError(q);
}

/* --------------------------------------------------------------------------
   Question builders, one per type in the contract
   -------------------------------------------------------------------------- */

const builders = {
  identity_name: (q) => textInput(q, { type: "text", autocomplete: "name" }),

  identity_email: (q) =>
    textInput(q, { type: "email", autocomplete: "email", inputmode: "email" }),

  identity_select: (q) => {
    const options = config[q.options_from] || [];
    const select = el("select", {
      class: "select",
      id: "f-" + q.key,
      "aria-labelledby": q.label ? "lbl-" + q.key : null,
    });
    select.appendChild(el("option", { value: "", text: "Choose one" }));
    for (const opt of options) {
      const value = typeof opt === "string" ? opt : opt.id;
      const label = typeof opt === "string" ? opt : opt.label;
      select.appendChild(el("option", { value, text: label }));
    }
    select.value = str(getVal(q));
    select.addEventListener("change", () => setVal(q, select.value));
    return select;
  },

  text: (q) => textInput(q, { type: "text" }),

  textarea: (q) => {
    const ta = el("textarea", {
      class: "textarea",
      id: "f-" + q.key,
      rows: 4,
      placeholder: q.placeholder || "",
      "aria-labelledby": q.label ? "lbl-" + q.key : null,
    });
    ta.value = str(getVal(q));
    ta.addEventListener("input", () => setVal(q, ta.value));
    return ta;
  },

  rating: (q) => {
    const min = Number.isFinite(q.min) ? q.min : 1;
    const max = Number.isFinite(q.max) ? q.max : 5;
    const group = el("div", {
      class: "survey-rating",
      role: "group",
      "aria-labelledby": q.label ? "lbl-" + q.key : null,
    });

    for (let n = min; n <= max; n++) {
      const value = n;
      let aria = String(n);
      if (n === min && q.minLabel) aria = n + ", " + q.minLabel;
      if (n === max && q.maxLabel) aria = n + ", " + q.maxLabel;

      const btn = el("button", {
        type: "button",
        text: String(n),
        "aria-pressed": String(getVal(q) === value),
        "aria-label": aria,
      });
      btn.addEventListener("click", () => {
        setVal(q, value);
        for (const sib of group.children) sib.setAttribute("aria-pressed", String(sib === btn));
      });
      group.appendChild(btn);
    }

    const holder = el("div", {}, [group]);
    if (q.minLabel || q.maxLabel) {
      holder.appendChild(
        el("div", { class: "survey-endlabels" }, [
          el("span", { text: q.minLabel || "" }),
          el("span", { text: q.maxLabel || "" }),
        ])
      );
    }
    return holder;
  },

  slider_pair: (q) => {
    const MIN = 1;
    const MAX = 7;
    const MID = 4;
    const saved = getVal(q);
    const touched = !!saved;
    const values = {
      current: saved && Number(saved.current) ? Number(saved.current) : MID,
      desired: saved && Number(saved.desired) ? Number(saved.desired) : MID,
    };

    const box = el("div", {
      class: "survey-sliderpair" + (touched ? "" : " survey-untouched"),
      role: "group",
      "aria-label": (q.left || "") + " to " + (q.right || ""),
    });

    box.appendChild(
      el("div", { class: "survey-pair-heading" }, [
        el("span", { text: q.left || "" }),
        el("span", { class: "survey-vs", text: "to" }),
        el("span", { text: q.right || "" }),
      ])
    );

    const hint = el("p", {
      class: "survey-slider-hint",
      text: "Tap anywhere on a line, or drag the marker. Both can land in the same place.",
      hidden: touched,
    });

    const commit = () => {
      box.classList.remove("survey-untouched");
      hint.hidden = true;
      setVal(q, { current: values.current, desired: values.desired });
    };

    const makeRow = (which, tagText, withEndWords) => {
      const readout = el("span", {
        class: "survey-slider-value",
        text: scaleWord(values[which], q),
      });
      const input = el("input", {
        type: "range",
        class: "survey-range survey-range-" + which,
        min: MIN,
        max: MAX,
        step: 1,
        value: values[which],
        "aria-label": tagText + ": " + (q.left || "") + " to " + (q.right || ""),
        "aria-valuetext": scaleWord(values[which], q),
      });
      input.addEventListener("input", () => {
        values[which] = Number(input.value);
        readout.textContent = scaleWord(values[which], q);
        input.setAttribute("aria-valuetext", readout.textContent);
        commit();
      });

      // Touching the control counts as answering it, even when the value does
      // not move. Someone who genuinely means "right in the middle" never fires
      // an input event, so without this their answer is silently dropped and the
      // slider keeps looking greyed out and inert.
      const NUDGE_KEYS = new Set([
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "PageUp",
        "PageDown",
      ]);
      input.addEventListener("pointerdown", commit);
      input.addEventListener("keydown", (e) => {
        if (NUDGE_KEYS.has(e.key)) commit();
      });

      const row = el("div", { class: "survey-slider-row" }, [
        el("div", { class: "survey-slider-tag" }, [el("span", { text: tagText }), readout]),
        input,
      ]);
      if (withEndWords) {
        row.appendChild(
          el("div", { class: "survey-endlabels" }, [
            el("span", { text: q.left || "" }),
            el("span", { text: q.right || "" }),
          ])
        );
      }
      return row;
    };

    box.appendChild(makeRow("current", "Today", false));
    box.appendChild(makeRow("desired", "Should be", true));
    box.appendChild(hint);
    return box;
  },

  wordbank: (q) => {
    const count = Number(q.count) || 0;
    const chosen = Array.isArray(getVal(q)) ? getVal(q).slice() : [];
    const base = Array.isArray(q.words) ? q.words : [];
    const words = base.concat(chosen.filter((w) => !base.includes(w)));

    const counter = el("span", { class: "counter" });
    const cap = el("p", { class: "field-helper", hidden: true, style: { marginTop: "0.5rem" } });
    const chipRow = el("div", { class: "chip-row" });

    const paint = () => {
      counter.textContent = chosen.length + " of " + count;
      counter.classList.toggle("is-complete", chosen.length === count);
      counter.classList.toggle("is-over", chosen.length > count);
    };

    const atLimitMessage = () =>
      "That is " + count + " already. Tap one of your picks to swap it out.";

    const addChip = (word) => {
      const chip = el("button", {
        type: "button",
        class: "chip",
        text: word,
        "aria-pressed": String(chosen.includes(word)),
      });
      chip.addEventListener("click", () => {
        const at = chosen.indexOf(word);
        if (at > -1) {
          chosen.splice(at, 1);
          cap.hidden = true;
        } else if (chosen.length >= count) {
          cap.textContent = atLimitMessage();
          cap.hidden = false;
          return;
        } else {
          chosen.push(word);
          cap.hidden = true;
        }
        chip.setAttribute("aria-pressed", String(chosen.includes(word)));
        paint();
        setVal(q, chosen.slice());
      });
      chipRow.appendChild(chip);
      return chip;
    };

    words.forEach(addChip);
    paint();

    const holder = el("div", {}, [
      el("div", { class: "survey-bank-head" }, [counter]),
      chipRow,
      cap,
    ]);

    if (q.allowWriteIn) {
      const input = el("input", {
        class: "input",
        type: "text",
        placeholder: "Add your own word",
        "aria-label": "Add your own word",
      });

      const add = () => {
        const word = str(input.value).toLowerCase();
        if (!word) return;
        if (chosen.includes(word)) {
          input.value = "";
          return;
        }
        if (chosen.length >= count) {
          cap.textContent = atLimitMessage();
          cap.hidden = false;
          return;
        }
        let chip = [...chipRow.children].find((c) => c.textContent === word);
        if (!chip) {
          words.push(word);
          chip = addChip(word);
        }
        chosen.push(word);
        chip.setAttribute("aria-pressed", "true");
        cap.hidden = true;
        paint();
        setVal(q, chosen.slice());
        input.value = "";
      };

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          add();
        }
      });

      holder.appendChild(
        el("div", { class: "survey-writein" }, [
          input,
          el("button", {
            type: "button",
            class: "btn btn-ghost btn-sm",
            text: "Add",
            onClick: add,
          }),
        ])
      );
    }

    return holder;
  },

  ab_pair: (q) => {
    const pair = state.flips[q.key] ? [q.b, q.a] : [q.a, q.b];
    const grid = el("div", {
      class: "survey-ab",
      role: "group",
      "aria-labelledby": q.label ? "lbl-" + q.key : null,
    });

    for (const option of pair) {
      if (!option) continue;

      const figure = el("div", { class: "survey-ab-figure" });
      if (option.img) {
        const img = el("img", { src: option.img, alt: option.label || "", loading: "lazy" });
        img.addEventListener("error", () => {
          figure.replaceChildren(
            el("span", { class: "survey-ab-fallback", text: option.label || "" })
          );
        });
        figure.appendChild(img);
      } else {
        figure.appendChild(el("span", { class: "survey-ab-fallback", text: option.label || "" }));
      }

      const card = el(
        "button",
        {
          type: "button",
          class: "survey-ab-card",
          "aria-pressed": String(getVal(q) === option.id),
        },
        [
          figure,
          el("span", { class: "survey-ab-label" }, [
            el("span", { class: "survey-ab-check", "aria-hidden": "true" }),
            el("span", { text: option.label || "" }),
          ]),
        ]
      );

      card.addEventListener("click", () => {
        setVal(q, option.id);
        for (const sib of grid.children) sib.setAttribute("aria-pressed", String(sib === card));
      });

      grid.appendChild(card);
    }

    return grid;
  },

  palette_grid: (q) => {
    const min = Number(q.min) || 0;
    const max = Number(q.max) || (q.palettes || []).length;
    const chosen = Array.isArray(getVal(q)) ? getVal(q).slice() : [];

    const counter = el("span", { class: "counter" });
    const cap = el("p", { class: "field-helper", hidden: true, style: { marginTop: "0.5rem" } });
    const grid = el("div", { class: "survey-palettes" });

    const paint = () => {
      counter.textContent = chosen.length + " of " + max;
      counter.classList.toggle("is-complete", chosen.length >= min && chosen.length <= max);
    };

    for (const p of q.palettes || []) {
      const strip = el(
        "span",
        { class: "swatches", "aria-hidden": "true" },
        (p.colors || []).map((c) => el("span", { style: { background: c } }))
      );

      const card = el(
        "button",
        {
          type: "button",
          class: "survey-palette",
          "aria-pressed": String(chosen.includes(p.id)),
          "aria-label": p.name || p.id,
        },
        [
          strip,
          el("span", { class: "survey-palette-name" }, [
            el("span", { text: p.name || p.id }),
            el("span", { class: "survey-box", "aria-hidden": "true" }),
          ]),
        ]
      );

      card.addEventListener("click", () => {
        const at = chosen.indexOf(p.id);
        if (at > -1) {
          chosen.splice(at, 1);
          cap.hidden = true;
        } else if (chosen.length >= max) {
          cap.textContent = "You can pick up to " + max + ". Tap one of your picks to swap it out.";
          cap.hidden = false;
          return;
        } else {
          chosen.push(p.id);
          cap.hidden = true;
        }
        card.setAttribute("aria-pressed", String(chosen.includes(p.id)));
        paint();
        setVal(q, chosen.slice());
      });

      grid.appendChild(card);
    }

    paint();
    return el("div", {}, [el("div", { class: "survey-bank-head" }, [counter]), grid, cap]);
  },

  image_pick: (q) => {
    const tiles = q.tiles || [];
    const min = Number(q.min) || 0;
    const max = Number(q.max) || tiles.length;
    const chosen = Array.isArray(getVal(q)) ? getVal(q).slice() : [];

    // Shuffled once per session and kept in the draft, so a Back and Next round
    // trip shows the same grid. The stored value is always the tile id.
    const byId = new Map(tiles.map((t) => [t.id, t]));
    const order = state.tileOrder[q.key] || tiles.map((t) => t.id);
    const shown = order.map((id) => byId.get(id)).filter(Boolean);

    const counter = el("span", { class: "counter" });
    const cap = el("p", { class: "field-helper", hidden: true, style: { marginTop: "0.5rem" } });
    const grid = el("div", {
      class: "survey-tiles",
      role: "group",
      "aria-labelledby": q.label ? "lbl-" + q.key : null,
    });

    const paint = () => {
      counter.textContent =
        chosen.length < min ? chosen.length + " of " + min : chosen.length + " picked";
      counter.classList.toggle("is-complete", chosen.length >= min && chosen.length <= max);
    };

    shown.forEach((tile, index) => {
      const figure = el("span", { class: "survey-tile-figure" });
      const img = el("img", { src: tile.img, alt: "", loading: "lazy" });
      figure.appendChild(img);

      const card = el(
        "button",
        {
          type: "button",
          class: "survey-tile",
          "aria-pressed": String(chosen.includes(tile.id)),
          "aria-label": "Design " + (index + 1),
        },
        [figure, el("span", { class: "survey-box", "aria-hidden": "true" })]
      );

      // A broken tile is worse than a shorter grid, so drop the whole card.
      img.addEventListener("error", () => {
        card.hidden = true;
      });

      card.addEventListener("click", () => {
        const at = chosen.indexOf(tile.id);
        if (at > -1) {
          chosen.splice(at, 1);
          cap.hidden = true;
        } else if (chosen.length >= max) {
          cap.textContent = "You can pick up to " + max + ". Tap one of your picks to swap it out.";
          cap.hidden = false;
          return;
        } else {
          chosen.push(tile.id);
          cap.hidden = true;
        }
        card.setAttribute("aria-pressed", String(chosen.includes(tile.id)));
        paint();
        setVal(q, chosen.slice());
      });

      grid.appendChild(card);
    });

    paint();
    return el("div", {}, [el("div", { class: "survey-bank-head" }, [counter]), grid, cap]);
  },

  multi_select: (q) => {
    const count = Number(q.count) || 0;
    const chosen = Array.isArray(getVal(q)) ? getVal(q).slice() : [];

    const counter = el("span", { class: "counter" });
    const cap = el("p", { class: "field-helper", hidden: true, style: { marginTop: "0.5rem" } });
    const list = el("div", { class: "survey-options", role: "group" });

    const paint = () => {
      counter.textContent = chosen.length + " of " + count;
      counter.classList.toggle("is-complete", chosen.length === count);
    };

    for (const opt of q.options || []) {
      const card = el(
        "button",
        {
          type: "button",
          class: "survey-option",
          "aria-pressed": String(chosen.includes(opt.id)),
        },
        [
          el("span", { class: "survey-box", "aria-hidden": "true" }),
          el("span", { text: opt.label || opt.id }),
        ]
      );

      card.addEventListener("click", () => {
        const at = chosen.indexOf(opt.id);
        if (at > -1) {
          chosen.splice(at, 1);
          cap.hidden = true;
        } else if (chosen.length >= count) {
          cap.textContent = "That is " + count + " already. Tap one of your picks to swap it out.";
          cap.hidden = false;
          return;
        } else {
          chosen.push(opt.id);
          cap.hidden = true;
        }
        card.setAttribute("aria-pressed", String(chosen.includes(opt.id)));
        paint();
        setVal(q, chosen.slice());
      });

      list.appendChild(card);
    }

    paint();
    return el("div", {}, [el("div", { class: "survey-bank-head" }, [counter]), list, cap]);
  },

  repeater: (q) => {
    const max = Number(q.max) || 1;
    const rows = Array.isArray(getVal(q)) && getVal(q).length ? getVal(q).slice() : [blankRow(q)];

    const holder = el("div", {});
    const list = el("div", { class: "survey-rows" });

    rows.forEach((row, index) => {
      const card = el("div", { class: "survey-row" });

      card.appendChild(
        el("div", { class: "survey-row-head" }, [
          el("span", { class: "survey-row-num", text: "#" + (index + 1) }),
          rows.length > 1
            ? el("button", {
                type: "button",
                class: "btn btn-quiet btn-sm",
                text: "Remove",
                onClick: () => {
                  rows.splice(index, 1);
                  setVal(q, rows.slice());
                  rerenderQuestion(q);
                },
              })
            : null,
        ])
      );

      for (const field of q.fields || []) {
        const input = el("input", {
          class: "input",
          type: field.type === "url" ? "url" : "text",
          inputmode: field.type === "url" ? "url" : null,
          placeholder: field.placeholder || "",
          "aria-label": field.label || field.key,
        });
        input.value = str(row[field.key]);
        input.addEventListener("input", () => {
          row[field.key] = input.value;
          setVal(q, rows.slice());
        });

        card.appendChild(
          el("div", { class: "survey-subfield" }, [
            el("span", { class: "survey-sublabel", text: field.label || field.key }),
            input,
          ])
        );
      }

      list.appendChild(card);
    });

    holder.appendChild(list);

    if (rows.length < max) {
      holder.appendChild(
        el("div", { class: "row", style: { marginTop: "0.75rem" } }, [
          el("button", {
            type: "button",
            class: "btn btn-ghost btn-sm",
            text: q.addLabel || "Add another",
            onClick: () => {
              rows.push(blankRow(q));
              setVal(q, rows.slice());
              rerenderQuestion(q);
            },
          }),
        ])
      );
    }

    return holder;
  },

  sentence: (q) => {
    const ta = el("textarea", {
      class: "textarea",
      rows: 3,
      placeholder: q.placeholder || "",
      "aria-label": q.prefix || q.label || "",
    });
    ta.value = str(getVal(q));
    ta.addEventListener("input", () => setVal(q, ta.value));

    return el("div", { class: "survey-sentence" }, [
      q.prefix ? el("span", { class: "survey-sentence-prefix", text: q.prefix }) : null,
      ta,
    ]);
  },
};

function textInput(q, attrs) {
  const input = el("input", {
    class: "input",
    id: "f-" + q.key,
    placeholder: q.placeholder || "",
    "aria-labelledby": q.label ? "lbl-" + q.key : null,
    ...attrs,
  });
  input.value = str(getVal(q));
  input.addEventListener("input", () => setVal(q, input.value));
  return input;
}

function blankRow(q) {
  const row = {};
  for (const field of q.fields || []) row[field.key] = "";
  return row;
}

function scaleWord(n, q) {
  const left = (q.left || "left").toLowerCase();
  const right = (q.right || "right").toLowerCase();
  const words = [
    "All the way " + left,
    "Mostly " + left,
    "Leaning " + left,
    "Right in the middle",
    "Leaning " + right,
    "Mostly " + right,
    "All the way " + right,
  ];
  return words[Math.min(6, Math.max(0, n - 1))];
}

/* --------------------------------------------------------------------------
   Validation. Only required fields and the count rules can block a section.
   -------------------------------------------------------------------------- */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlankRow(row) {
  return Object.values(row || {}).every((v) => !str(v));
}

function validateQuestion(q) {
  const value = getVal(q);

  switch (q.type) {
    case "identity_email": {
      if (q.required && !str(value)) return "Please add your email so we can follow up.";
      if (str(value) && !EMAIL_PATTERN.test(str(value))) {
        return "That email does not look right. Mind checking it?";
      }
      return null;
    }

    case "identity_name":
    case "identity_select":
    case "text":
    case "textarea":
    case "sentence":
      return q.required && !str(value) ? "Please answer this one to keep going." : null;

    case "rating":
      return q.required && typeof value !== "number" ? "Pick a number to keep going." : null;

    case "slider_pair":
      return q.required && !value ? "Set both markers to keep going." : null;

    case "ab_pair":
      return q.required && !value ? "Pick one to keep going." : null;

    case "wordbank":
    case "multi_select": {
      const n = Array.isArray(value) ? value.length : 0;
      const count = Number(q.count) || 0;
      return n === count ? null : "Pick exactly " + count + ". You have " + n + " so far.";
    }

    case "palette_grid": {
      const n = Array.isArray(value) ? value.length : 0;
      const min = Number(q.min) || 0;
      const max = Number(q.max) || n;
      if (n < min) return "Pick at least " + min + ". You have " + n + " so far.";
      if (n > max) return "Pick no more than " + max + ".";
      return null;
    }

    case "image_pick": {
      const n = Array.isArray(value) ? value.length : 0;
      const min = Number(q.min) || 0;
      const max = Number(q.max) || n;
      if (n < min) return "Pick at least " + min + ". You have " + n + " so far.";
      if (n > max) return "Pick no more than " + max + ".";
      return null;
    }

    case "repeater": {
      const rows = Array.isArray(value) ? value : [];
      for (let i = 0; i < rows.length; i++) {
        if (isBlankRow(rows[i])) continue;
        for (const field of q.fields || []) {
          if (field.required && !str(rows[i][field.key])) {
            return "Row " + (i + 1) + ': add "' + (field.label || field.key) + '" or clear the row.';
          }
        }
      }
      return null;
    }

    default:
      return null;
  }
}

function refreshError(q) {
  const node = questionNodes.get(q.key);
  if (!node) return;
  const slot = node.querySelector('[data-error-for="' + cssEscape(q.key) + '"]');
  if (!slot) return;

  const message = validateQuestion(q);
  if (message) {
    errors[q.key] = message;
    slot.textContent = message;
    slot.hidden = false;
    node.classList.add("has-error");
  } else {
    delete errors[q.key];
    slot.textContent = "";
    slot.hidden = true;
    node.classList.remove("has-error");
  }
}

function cssEscape(value) {
  return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"');
}

function validateSection(section) {
  // Review mode: click straight through, nothing is required.
  if (config.reviewMode) return true;

  const questions = sectionQuestions(section);

  errors = {};
  for (const q of questions) {
    const message = validateQuestion(q);
    if (message) errors[q.key] = message;
  }

  showErrors = true;
  for (const q of questions) refreshError(q);

  const firstBad = questions.find((q) => errors[q.key]);
  if (!firstBad) return true;

  const node = questionNodes.get(firstBad.key);
  if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  return false;
}

/* --------------------------------------------------------------------------
   Submit
   -------------------------------------------------------------------------- */

function buildPayload() {
  const respondent = { name: "", email: "", role: "", tenure: "" };
  const answers = {};

  for (const section of config.sections || []) {
    for (const q of section.questions || []) {
      const value = getVal(q);

      if (isIdentity(q)) {
        respondent[q.key] = str(value);
        continue;
      }

      if (q.type === "repeater") {
        const rows = (Array.isArray(value) ? value : [])
          .filter((row) => !isBlankRow(row))
          .map((row) => {
            const clean = {};
            for (const field of q.fields || []) clean[field.key] = str(row[field.key]);
            return clean;
          });
        if (rows.length) answers[q.key] = rows;
        continue;
      }

      if (typeof value === "string") {
        if (str(value)) answers[q.key] = str(value);
      } else if (Array.isArray(value)) {
        if (value.length) answers[q.key] = value;
      } else if (value !== null && value !== undefined) {
        answers[q.key] = value;
      }
    }
  }

  return { respondent, answers };
}

async function submit() {
  if (submitting) return;

  // Review mode never saves, so walkthroughs leave no rows in the dashboard.
  if (config.reviewMode) {
    clearDraft();
    renderDone();
    return;
  }

  submitting = true;
  updateChrome();

  let res;
  try {
    res = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
  } catch (err) {
    submitting = false;
    failWithRetry("We could not reach the server. Check your connection and try again.");
    return;
  }

  if (res.status === 201 || res.status === 200) {
    clearDraft();
    renderDone();
    return;
  }

  if (res.status === 409) {
    submitting = false;
    renderDuplicate();
    return;
  }

  submitting = false;
  failWithRetry(
    "Something went wrong on our end. Your answers are still here, so please try again."
  );
}

function failWithRetry(message) {
  pendingNotice = el("div", { class: "survey-notice", role: "alert" }, [
    el("h3", { text: "That did not send." }),
    el("p", { text: message }),
    el("div", { class: "row", style: { marginTop: "1rem" } }, [
      el("button", {
        type: "button",
        class: "btn btn-primary",
        text: "Try again",
        onClick: () => submit(),
      }),
    ]),
  ]);
  renderSection();
  updateChrome();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDuplicate() {
  const email = str(state.respondent.email);
  $("survey-foot").hidden = true;

  $("view").replaceChildren(
    el("div", { class: "survey-notice", role: "alert" }, [
      el("h3", { text: "This email already has a response." }),
      el("p", {
        text:
          (email ? email : "This address") +
          " is already recorded, so we did not save a second one. If you need it reopened, contact whoever sent you this link.",
      }),
      el("div", { class: "row", style: { marginTop: "1rem" } }, [
        el("button", {
          type: "button",
          class: "btn btn-ghost",
          text: "Back to my answers",
          onClick: () => {
            $("survey-foot").hidden = false;
            goTo(state.sectionIndex);
          },
        }),
      ]),
    ])
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDone() {
  const done = config.confirmation || {};
  $("survey-head").hidden = true;
  $("survey-foot").hidden = true;
  $("deadline-banner").classList.add("hidden");

  $("view").replaceChildren(
    el("div", { class: "survey-done" }, [
      el("div", { class: "survey-seal", "aria-hidden": "true", text: "✓" }),
      el("h1", { class: "display", text: done.headline || "Thank you." }),
      done.body ? el("p", { class: "survey-done-body", text: done.body }) : null,
      config.reviewMode
        ? el("div", { class: "row", style: { marginTop: "1.5rem", justifyContent: "center" } }, [
            el("button", {
              type: "button",
              class: "btn btn-primary",
              text: "Review mode: start over",
              onClick: () => location.reload(),
            }),
          ])
        : null,
    ])
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}
