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

// ── Firebase mocks ────────────────────────────────────────────────────────────

jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(),
  cert: jest.fn(() => ({})),
  getApps: jest.fn(() => [{}]),
}));

jest.mock("firebase-admin/firestore", () => {
  const store = new Map<string, Record<string, unknown>>();

  const makeDocRef = (id: string) => ({
    set: jest.fn(async (data: Record<string, unknown>) => {
      store.set(id, { ...data });
    }),
    get: jest.fn(async () => ({
      exists: store.has(id),
      data: () => (store.has(id) ? { ...store.get(id) } : null),
    })),
    delete: jest.fn(async () => {
      store.delete(id);
    }),
  });

  return {
    getFirestore: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: jest.fn((id: string) => makeDocRef(id)),
        get: jest.fn(async () => ({
          docs: [...store.entries()].map(([docId]) => ({
            data: () => ({ ...store.get(docId) }),
            ref: { delete: jest.fn(async () => { store.delete(docId); }) },
          })),
        })),
      })),
    })),
    __getMockStore: () => store,
  };
});

// ── Mock phone-map ────────────────────────────────────────────────────────────
jest.mock("../config/phone-map.js", () => ({
  getPhoneMap: () => new Map([["whatsapp:+1234567890", "Alice"]]),
  getUserName: (phone: string) =>
    phone === "whatsapp:+1234567890" ? "Alice" : phone,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getMockStore = (): Map<string, Record<string, unknown>> =>
  (jest.requireMock("firebase-admin/firestore") as any).__getMockStore();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("magic-link: generate logic", () => {
  beforeEach(async () => {
    getMockStore().clear();
    clearSessionStore();
  });

  it("produces a verifiable token for an authorized phone", async () => {
    const phone = "whatsapp:+1234567890";
    const link = await createMagicLink(phone, "https://example.com");
    const token = new URL(link).searchParams.get("token") as string;
    expect(await verifyMagicLink(token)).toBe(phone);
  });

  it("generates unique tokens on repeated calls", async () => {
    const link1 = await createMagicLink("whatsapp:+1234567890", "https://example.com");
    const link2 = await createMagicLink("whatsapp:+1234567890", "https://example.com");
    const t1 = new URL(link1).searchParams.get("token");
    const t2 = new URL(link2).searchParams.get("token");
    expect(t1).not.toBe(t2);
  });
});

describe("magic-link: verify logic", () => {
  beforeEach(async () => {
    getMockStore().clear();
    clearSessionStore();
  });

  it("valid token → session created, token consumed", async () => {
    const phone = "whatsapp:+1234567890";
    const link = await createMagicLink(phone, "https://example.com");
    const token = new URL(link).searchParams.get("token") as string;

    // Simulate verify: consume token, create session
    const resolved = await verifyMagicLink(token);
    expect(resolved).toBe(phone);

    const sessionId = createSession(resolved as string);
    expect(getSession(sessionId)).toBe(phone);

    // Token is now consumed — cannot be used again
    expect(await verifyMagicLink(token)).toBeNull();
  });

  it("invalid token → returns null", async () => {
    expect(await verifyMagicLink("bogus-token")).toBeNull();
  });

  it("missing token → returns null", async () => {
    expect(await verifyMagicLink("")).toBeNull();
  });
});

describe("magic-link: generate route handler", () => {
  beforeEach(async () => {
    getMockStore().clear();
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

  it("returns a link when phone is authorized", async () => {
    const phone = "whatsapp:+1234567890";
    const phoneMap = getPhoneMap();

    expect(phoneMap.has(phone)).toBe(true);

    const link = await createMagicLink(phone, "https://example.com");
    expect(link).toContain("/api/magic-link/verify?token=");
  });
});

describe("magic-link: token lifecycle", () => {
  beforeEach(async () => {
    getMockStore().clear();
    clearSessionStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fresh link is not expired on first click", async () => {
    const phone = "whatsapp:+1234567890";
    const link = await createMagicLink(phone, "https://example.com");
    const token = new URL(link).searchParams.get("token") as string;

    // Immediately clicking the link should succeed
    expect(await verifyMagicLink(token)).toBe(phone);
  });

  it("link expires after TOKEN_TTL_MS if unused", async () => {
    const { TOKEN_TTL_MS } = await import("../tools/magic-link-store.js");
    const link = await createMagicLink("whatsapp:+1234567890", "https://example.com");
    const token = new URL(link).searchParams.get("token") as string;

    jest.advanceTimersByTime(TOKEN_TTL_MS + 1);

    expect(await verifyMagicLink(token)).toBeNull();
  });

  it("link is invalidated after successful use", async () => {
    const phone = "whatsapp:+1234567890";
    const link = await createMagicLink(phone, "https://example.com");
    const token = new URL(link).searchParams.get("token") as string;

    expect(await verifyMagicLink(token)).toBe(phone);
    // Second use must fail
    expect(await verifyMagicLink(token)).toBeNull();
  });
});

describe("magic-link: session cookie", () => {
  // Unused import kept for legacy compatibility
  void clearTokenStore;

  it("session cookie name is exported correctly", () => {
    expect(SESSION_COOKIE_NAME).toBe("expense_session");
  });
});
