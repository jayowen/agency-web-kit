// GET /api/admin/data
// Returns every respondent with their answers inlined, newest first.
// { ok: true, respondents: [ { id, name, email, role, tenure, tags: [], admin_note, submitted_at, answers: {key: value} } ] }

import { requireAdmin, json } from "../_auth.js";

export async function onRequestGet(ctx) {
  const denied = requireAdmin(ctx, { allowClient: true });
  if (denied) return denied;

  const { env } = ctx;

  const [people, rows] = await Promise.all([
    env.DB.prepare(
      `SELECT id, name, email, role, tenure, tags, admin_note, submitted_at
       FROM respondents ORDER BY submitted_at DESC`
    ).all(),
    env.DB.prepare(
      `SELECT respondent_id, question_key, value_json FROM answers`
    ).all(),
  ]);

  const byPerson = new Map();
  for (const row of rows.results || []) {
    if (!byPerson.has(row.respondent_id)) byPerson.set(row.respondent_id, {});
    let parsed;
    try {
      parsed = JSON.parse(row.value_json);
    } catch {
      parsed = row.value_json;
    }
    byPerson.get(row.respondent_id)[row.question_key] = parsed;
  }

  const respondents = (people.results || []).map((p) => ({
    ...p,
    tags: p.tags ? p.tags.split(",").filter(Boolean) : [],
    answers: byPerson.get(p.id) || {},
  }));

  return json({ ok: true, count: respondents.length, respondents });
}
