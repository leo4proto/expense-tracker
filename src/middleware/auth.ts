import type { Request, Response, NextFunction } from "express";
import { getSession, SESSION_COOKIE_NAME } from "../tools/session-store.js";

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((pair) => {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) return [pair.trim(), ""];
      const key = pair.slice(0, eqIdx).trim();
      const val = pair.slice(eqIdx + 1).trim();
      return [key, decodeURIComponent(val)];
    })
  );
}

/**
 * Express middleware that validates the HTTP-only session cookie.
 * Sets `res.locals.userPhone` on success; redirects to /error on failure.
 */
export function requireSession(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE_NAME];

  if (!sessionId) {
    res.redirect("/error?reason=no_session");
    return;
  }

  const phone = getSession(sessionId);
  if (!phone) {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.redirect("/error?reason=expired");
    return;
  }

  res.locals["userPhone"] = phone;
  next();
}
