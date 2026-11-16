// Shared admin auth for /api/admin/* routes.
// The dashboard sends: Authorization: Bearer <ADMIN_PASSWORD>

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// Optional CLIENT_PASSWORD gives the client a login that can view everything
// and change tags, but cannot delete responses.

export function roleFor({ request, env }) {
  const header = request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  if (env.ADMIN_PASSWORD && token === env.ADMIN_PASSWORD) return "admin";
  if (env.CLIENT_PASSWORD && token === env.CLIENT_PASSWORD) return "client";
  return null;
}

export function requireAdmin(ctx, { allowClient = false } = {}) {
  if (!ctx.env.ADMIN_PASSWORD) {
    return json({ ok: false, error: "admin_password_not_set" }, 500);
  }
  const role = roleFor(ctx);
  if (role === "admin" || (allowClient && role === "client")) return null; // authorized
  return json({ ok: false, error: "unauthorized" }, 401);
}
