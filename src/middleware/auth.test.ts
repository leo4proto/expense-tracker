import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { requireSession } from "./auth.js";
import {
  createSession,
  clearSessionStore,
  SESSION_COOKIE_NAME,
} from "../tools/session-store.js";

function makeReqRes(cookieHeader?: string): {
  req: Request;
  res: Response;
  next: NextFunction;
} {
  const req = {
    headers: { cookie: cookieHeader },
  } as unknown as Request;

  const locals: Record<string, unknown> = {};
  const res = {
    locals,
    redirect: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  const next = jest.fn() as unknown as NextFunction;

  return { req, res, next };
}

describe("requireSession middleware", () => {
  beforeEach(() => {
    clearSessionStore();
  });

  it("calls next() when a valid session cookie is present", () => {
    const phone = "whatsapp:+1234567890";
    const sessionId = createSession(phone);
    const cookie = `${SESSION_COOKIE_NAME}=${sessionId}`;

    const { req, res, next } = makeReqRes(cookie);
    requireSession(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.locals["userPhone"]).toBe(phone);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("redirects to /error?reason=no_session when no cookie is present", () => {
    const { req, res, next } = makeReqRes(undefined);
    requireSession(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith("/error?reason=no_session");
    expect(next).not.toHaveBeenCalled();
  });

  it("redirects to /error?reason=expired when the session is not in the store", () => {
    const cookie = `${SESSION_COOKIE_NAME}=not-a-real-session-id`;
    const { req, res, next } = makeReqRes(cookie);
    requireSession(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith("/error?reason=expired");
    expect(next).not.toHaveBeenCalled();
  });

  it("sets res.locals.userPhone to the correct phone", () => {
    const phone = "whatsapp:+9999999999";
    const sessionId = createSession(phone);
    const cookie = `${SESSION_COOKIE_NAME}=${sessionId}; other_cookie=value`;

    const { req, res, next } = makeReqRes(cookie);
    requireSession(req, res, next);

    expect(res.locals["userPhone"]).toBe(phone);
  });

  it("handles cookies with URL-encoded values", () => {
    const phone = "whatsapp:+1234567890";
    const sessionId = createSession(phone);
    const encoded = encodeURIComponent(sessionId);
    const cookie = `${SESSION_COOKIE_NAME}=${encoded}`;

    const { req, res, next } = makeReqRes(cookie);
    requireSession(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
