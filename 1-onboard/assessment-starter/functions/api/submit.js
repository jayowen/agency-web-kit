// POST /api/submit
// Body: { respondent: {name, email, role, tenure}, answers: { [key]: value }, override?: true }
// 201 -> { ok: true, id }
// 409 -> { ok: false, error: "duplicate" }  (same email already submitted)

import { SEGMENTS } from "./_segments.js";
import { roleFor } from "./_auth.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  const r = body.respondent || {};
  const name = String(r.name || "").trim();
  const email = String(r.email || "").trim().toLowerCase();
  const answers = body.answers || {};

  if (!name) return json({ ok: false, error: "name_required" }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return json({ ok: false, error: "email_invalid" }, 400);

  const existing = await env.DB.prepare(
    "SELECT id FROM respondents WHERE lower(email) = ?"
  )
    .bind(email)
    .first();

  // Only an admin may replace an existing submission. The public form never
  // sends override; a request that does must carry the admin password.
  const canOverride = body.override === true && roleFor({ request, env }) === "admin";
  if (existing && !canOverride) {
    return json({ ok: false, error: "duplicate" }, 409);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const statements = [];

  if (existing) {
    // Admin-approved override: replace the previous submission entirely.
    statements.push(
      env.DB.prepare("DELETE FROM answers WHERE respondent_id = ?").bind(existing.id)
    );
    statements.push(
      env.DB.prepare("DELETE FROM respondents WHERE id = ?").bind(existing.id)
    );
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO respondents (id, name, email, role, tenure, tags, admin_note, submitted_at, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)`
    ).bind(
      id,
      name,
      email,
      String(r.role || ""),
      String(r.tenure || ""),
      SEGMENTS[email] || "",
      now,
      request.headers.get("user-agent") || ""
    )
  );

  for (const [key, value] of Object.entries(answers)) {
    if (value === undefined || value === null || value === "") continue;
    statements.push(
      env.DB.prepare(
        "INSERT INTO answers (respondent_id, question_key, value_json) VALUES (?, ?, ?)"
      ).bind(id, key, JSON.stringify(value))
    );
  }

  try {
    await env.DB.batch(statements);
  } catch (err) {
    console.error("submit db_error", err);
    return json({ ok: false, error: "db_error" }, 500);
  }

  return json({ ok: true, id }, 201);
}
