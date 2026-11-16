// POST   /api/admin/respondent  -> update tags and/or admin_note
//        Body: { id, tags: ["vote","veto"], admin_note?: "..." }
// DELETE /api/admin/respondent  -> remove a submission (frees the email for a re-take)
//        Body: { id }

import { requireAdmin, json } from "../_auth.js";

export async function onRequestPost(ctx) {
  const denied = requireAdmin(ctx, { allowClient: true });
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => ({}));
  if (!body.id) return json({ ok: false, error: "id_required" }, 400);

  const tags = Array.isArray(body.tags) ? body.tags.join(",") : "";
  const note = typeof body.admin_note === "string" ? body.admin_note : "";

  await ctx.env.DB.prepare(
    "UPDATE respondents SET tags = ?, admin_note = ? WHERE id = ?"
  )
    .bind(tags, note, body.id)
    .run();

  return json({ ok: true });
}

export async function onRequestDelete(ctx) {
  const denied = requireAdmin(ctx);
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => ({}));
  if (!body.id) return json({ ok: false, error: "id_required" }, 400);

  await ctx.env.DB.batch([
    ctx.env.DB.prepare("DELETE FROM answers WHERE respondent_id = ?").bind(body.id),
    ctx.env.DB.prepare("DELETE FROM respondents WHERE id = ?").bind(body.id),
  ]);

  return json({ ok: true });
}
