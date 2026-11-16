# meta.json format

`<concept-folder>/meta.json` feeds the before/after page. Every field below is required when `status` is `done`. Write for business owners: plain words, no jargon, no em dashes.

```json
{
  "slug": "acme-roofing",
  "name": "Acme Roofing",
  "url": "https://acmeroofing.com/",
  "industry": "Residential roofing contractor",
  "status": "done",
  "mode": "pitch",
  "tagline": "One sentence on what the new homepage does for them.",
  "design_thesis": "Two sentences: the one idea the page expresses and how it shows up.",
  "archetype": "F. Diagram-led",
  "hero": "H5. Framed photo on a color field",
  "nav": "N2. Logo centered, links split",
  "footer": "F7. The schematic again, as a parts list",
  "sections": ["Hero", "Filter schematic", "Three steps on the diagram", "Reviews ledger", "Service area map", "Closing call", "Footer"],
  "created": "2026-10-22",
  "ground": "deep slate #1F2A33 with copper #B8733D accents",
  "palette": ["#1F2A33", "#B8733D", "#F4F1EC"],
  "fonts": ["Display Font", "Body Font"],
  "problems": [
    "Four specific, factual problems with the current site, one line each."
  ],
  "changes": [
    "Four or five specific things the new homepage does better, one line each."
  ],
  "one_liner": "The brief's one-liner, in plain words.",
  "primary_action": { "label": "Book a table", "href": "https://..." },
  "conversion": [
    "Three plain-English lines on what makes the new page convert (where the main button sits, the proof near it, the phone path)."
  ],
  "before": { "desktop": "before/desktop.jpg", "mobile": "before/mobile.jpg" },
  "after": { "desktop": "after/desktop.jpg", "mobile": "after/mobile.jpg" },
  "concept": "concept/index.html",
  "difference": "One line from the strategy: what this company can say that its competitors cannot.",
  "scores": { "creative_direction": 9, "art_direction": 9, "messaging": 9, "conversion": 9, "craft": 9 },
  "outcome": { "status": "not sent", "date": "", "note": "" }
}
```

`hero`, `nav` and `footer` are the design log: a code from the design bar's "Hero, nav and footer types" plus a short name (or a new short name if none fit). `sections` lists the page in order. `created` is the build date. The workspace list reads these so the next concept does not repeat them.

`mode` is `pitch` or `client`. `scores` is copied from the outside judge's last scorecard, never self-scored. `outcome.status` is one of: not sent, sent, meeting booked, won, lost, no reply. It starts as `not sent` and you update it; it is how you learn which concepts win.

If the site cannot be redesigned (dead, parked, sold to another company), write only `slug`, `name`, `url`, `"status": "skipped"` and a `"note"` with the reason.
