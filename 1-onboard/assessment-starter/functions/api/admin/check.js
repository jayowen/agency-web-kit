// GET /api/admin/check -> 200 if the password is right, 401 if not.
// Used by the dashboard login screen before it loads any data.

import { requireAdmin, roleFor, json } from "../_auth.js";

export async function onRequestGet(ctx) {
  const denied = requireAdmin(ctx, { allowClient: true });
  if (denied) return denied;
  return json({ ok: true, role: roleFor(ctx) });
}
