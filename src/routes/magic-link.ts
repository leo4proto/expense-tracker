import { Router, type Request, type Response } from "express";
import { createMagicLink, verifyMagicLink } from "../tools/magic-link-store.js";
import { createSession, SESSION_COOKIE_NAME, SESSION_TTL_MS } from "../tools/session-store.js";
import { getPhoneMap } from "../config/phone-map.js";
import { env } from "../config/env.js";

const router = Router();

function getBaseUrl(req: Request): string {
  if (env.baseUrl) return env.baseUrl;
  const protocol = req.headers["x-forwarded-proto"] ?? req.protocol;
  return `${protocol}://${req.headers.host}`;
}

/**
 * POST /api/magic-link/generate
 * Body: { phone: string }
 *
 * Generates a one-time magic link for an authorized phone number.
 * Returns { link } on success or 403/400 on failure.
 * Note: the WhatsApp webhook calls createMagicLink() directly rather than
 * hitting this HTTP endpoint; this endpoint exists for API completeness.
 */
router.post("/generate", async (req: Request, res: Response) => {
  const { phone } = req.body as { phone?: string };

  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }

  const phoneMap = getPhoneMap();
  if (!phoneMap.has(phone)) {
    res.status(403).json({ error: "Phone number not authorized" });
    return;
  }

  const baseUrl = getBaseUrl(req);
  const link = await createMagicLink(phone, baseUrl);
  res.json({ link });
});

/**
 * GET /api/magic-link/verify?token=...
 *
 * Validates a one-time token. On success, creates an HTTP-only session cookie
 * and redirects to /dashboard. On failure, redirects to /error.
 */
router.get("/verify", async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };

  if (!token) {
    res.redirect("/error?reason=missing_token");
    return;
  }

  const phone = await verifyMagicLink(token);
  if (!phone) {
    res.redirect("/error?reason=invalid_or_expired");
    return;
  }

  const sessionId = createSession(phone);

  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
  });

  // Serve a 200 HTML page that navigates via JavaScript rather than issuing a
  // 302 redirect.  Some mobile WebViews (notably WKWebView on iOS) silently
  // drop Set-Cookie headers on 302 responses, so the browser never stores the
  // session cookie and the /dashboard middleware immediately redirects back to
  // /error?reason=no_session.  A 200 response guarantees the browser commits
  // the Set-Cookie header before any JavaScript runs.
  res.type("text/html").send(
    '<!doctype html><html><head><meta charset="utf-8"><title>Connecting\u2026</title>' +
      "<script>location.replace('/dashboard')</script>" +
      "</head><body></body></html>"
  );
});

export default router;
