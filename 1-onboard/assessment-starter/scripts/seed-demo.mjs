// Generates sample respondents that fit YOUR client.config.json, so a new
// dashboard has something to show before real answers arrive.
// Usage:
//   node scripts/seed-demo.mjs 20 > seed.sql
//   npx wrangler d1 execute <db-name> --local --file=seed.sql      (local)
//   npx wrangler d1 execute <db-name> --remote --file=seed.sql     (demo copies only)
// Sample emails end in @example.com so you can find and delete them later:
//   DELETE FROM answers WHERE respondent_id IN (SELECT id FROM respondents WHERE email LIKE '%@example.com');
//   DELETE FROM respondents WHERE email LIKE '%@example.com';
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const n = Number(process.argv[2] || 20);
const c = JSON.parse(readFileSync(process.argv[3] || "public/client.config.json", "utf8"));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
const some = (a, k) => shuffle(a).slice(0, k);
const int = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const FIRST = ["Avery","Jordan","Riley","Sam","Morgan","Casey","Taylor","Jamie","Drew","Quinn","Reese","Parker","Rowan","Blake","Hayden","Emerson","Sage","Logan","Kai","Remy"];
const LAST = ["Lee","Patel","Garcia","Nguyen","Brooks","Reed","Hayes","Cole","Price","Ward","Ellis","Grant"];
const TEXT = ["Easy to find the phone number.","Hard to know where to start.","The photos feel real.","Too many menus.",
  "I like the events page.","Mobile is tough to use.","Make the next step obvious.","Keep it simple.","More stories from real people.",""];
const tags = (c.admin?.tags || []).map(t => t.id);

const sql = [];
for (let i = 0; i < n; i++) {
  const id = randomUUID();
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  const email = `sample${i + 1}@example.com`;
  const role = pick(c.roles || [""]), tenure = pick(c.tenures || [""]);
  const tag = Math.random() < 0.3 && tags.length ? pick(tags) : "";
  const when = new Date(Date.now() - int(0, 10) * 864e5).toISOString();
  sql.push(`INSERT INTO respondents (id,name,email,role,tenure,tags,admin_note,submitted_at,user_agent) VALUES (${q(id)},${q(name)},${q(email)},${q(role)},${q(tenure)},${q(tag)},'',${q(when)},'seed');`);
  for (const s of c.sections || []) for (const x of s.questions || []) {
    let v;
    switch (x.type) {
      case "text": case "textarea": v = pick(TEXT); break;
      case "sentence": v = pick(["feels like us","made it easy","was worth the wait","helped me take a step"]); break;
      case "rating": v = int(x.min ?? 1, x.max ?? 5); break;
      case "slider_pair": { const cur = int(1, 7); v = { current: cur, desired: Math.min(7, Math.max(1, cur + int(-1, 3))) }; break; }
      case "wordbank": v = some(x.words || [], x.count || 1); break;
      case "multi_select": v = some((x.options || []).map(o => o.id), x.count || 1); break;
      case "ab_pair": v = Math.random() < 0.6 ? x.a?.id : x.b?.id; break;
      case "palette_grid": v = some((x.palettes || []).map(p => p.id), int(x.min || 1, x.max || 2)); break;
      case "image_pick": v = some((x.tiles || []).map(t => t.id), int(x.min || 1, x.max || 3)); break;
      case "repeater": v = Math.random() < 0.5 ? [Object.fromEntries((x.fields || []).map(f => [f.key, f.type === "url" ? "https://example.com" : "Clean and clear"]))] : []; break;
      default: continue; // identity fields live on the respondent row
    }
    if (v === "" || v == null || (Array.isArray(v) && !v.length)) continue;
    sql.push(`INSERT INTO answers (respondent_id,question_key,value_json) VALUES (${q(id)},${q(x.key)},${q(JSON.stringify(v))});`);
  }
}
console.log(sql.join("\n"));
