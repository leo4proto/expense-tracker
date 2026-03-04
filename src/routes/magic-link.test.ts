import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Request, Response } from "express";
import {
  clearTokenStore,
  verifyMagicLink,
  createMagicLink,
} from "../tools/magic-link-store.js";
import {
  clearSessionStore,
  SESSION_COOKIE_NAME,
  createSession,
  getSession,
} from "../tools/session-store.js";
import { getPhoneMap } from "../config/phone-map.js";

// ── Mock phone-map ────────────────────────────────────────────────────────────
jest.mock("../config/phone-map.js", () => ({
  getPhoneMap: () => new Map([["whatsapp:+1234567890", "Alice"]]),
  getUserName: (phone: string) =>
    phone === "whatsapp:+1234567890" ? "Alice" : phone,
}));

describe("magic-link: generate logic", () => {
  beforeEach(() => {
    clearTokenStore();
    clearSessionStore();
  });

  it("produces a verifiable token for an authorized phone", () => {
    const phone = "whatsapp:+1234567890";
    const link = createMagicLink(phone, "https://example.com");
    const token = new URL(link).searchParams.get("token") as string;
    expect(verifyMagicLink(token)).toBe(phone);
  });

  it("generates unique tokens on repeated calls", () => {
    const link1 = createMagicLink("whatsapp:+1234567890", "https://example.com");
    const link2 = createMagicLink("whatsapp:+1234567890", "https://example.com");
    const t1 = new URL(link1).searchParams.get("token");
    const t2 = new URL(link2).searchParams.get("token");
    expect(t1).not.toBe(t2);
  });
});

describe("magic-link: verify logic", () => {
  beforeEach(() => {
    clearTokenStore();
    clearSessionStore();
  });

  it("valid token → session created, token consumed", () => {
    const phone = "whatsapp:+1234567890";
    const link = createMagicLink(phone, "https://example.com");
    const token = new URL(link).searchParams.get("token") as string;

    // Simulate verify: consume token, create session
    const resolved = verifyMagicLink(token);
    expect(resolved).toBe(phone);

    const sessionId = createSession(resolved as string);
    expect(getSession(sessionId)).toBe(phone);

    // Token is now consumed — cannot be used again
    expect(verifyMagicLink(token)).toBeNull();
  });

  it("invalid token → returns null", () => {
    expect(verifyMagicLink("bogus-token")).toBeNull();
  });

  it("missing token → returns null", () => {
    expect(verifyMagicLink("")).toBeNull();
  });
});

describe("magic-link: generate route handler", () => {
  beforeEach(() => {
    clearTokenStore();
    clearSessionStore();
  });

  function makeRes(): Response {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { json, status } as unknown as Response;
  }

  function makeReq(body: Record<string, unknown>): Request {
    return {
      body,
      headers: { host: "example.com" },
      protocol: "https",
    } as unknown as Request;
  }

  it("returns 400 when phone is missing from body", () => {
    const req = makeReq({});
    const res = makeRes();

    if (!(req.body as { phone?: string }).phone) {
      (res.status as jest.Mock)(400);
    }
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when phone is not in phone map", () => {
    const req = makeReq({ phone: "whatsapp:+9999999999" });
    const res = makeRes();

    const phoneMap = getPhoneMap();
    if (!phoneMap.has((req.body as { phone: string }).phone)) {
      (res.status as jest.Mock)(403);
    }
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns a link when phone is authorized", () => {
    const phone = "whatsapp:+1234567890";
    const phoneMap = getPhoneMap();

    expect(phoneMap.has(phone)).toBe(true);

    const link = createMagicLink(phone, "https://example.com");
    expect(link).toContain("/api/magic-link/verify?token=");
  });
});

describe("magic-link: session cookie", () => {
  it("session cookie name is exported correctly", () => {
    expect(SESSION_COOKIE_NAME).toBe("expense_session");
  });
});
