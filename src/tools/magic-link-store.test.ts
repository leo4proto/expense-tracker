import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";

// ── Firestore mock ────────────────────────────────────────────────────────────

jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(),
  cert: jest.fn(() => ({})),
  getApps: jest.fn(() => [{}]), // Pretend app is already initialised
}));

jest.mock("firebase-admin/firestore", () => {
  // Shared in-memory backing store — captured by all mock closures below.
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

  const makeCollRef = () => ({
    doc: jest.fn((id: string) => makeDocRef(id)),
    get: jest.fn(async () => ({
      docs: [...store.entries()].map(([docId]) => ({
        data: () => ({ ...store.get(docId) }),
        ref: {
          delete: jest.fn(async () => {
            store.delete(docId);
          }),
        },
      })),
    })),
    where: jest.fn((field: string, op: string, value: unknown) => ({
      get: jest.fn(async () => ({
        docs: [...store.entries()]
          .filter(([, data]) => {
            const v = (data as Record<string, number>)[field];
            if (op === "<") return v < (value as number);
            if (op === "<=") return v <= (value as number);
            if (op === ">") return v > (value as number);
            if (op === ">=") return v >= (value as number);
            return false;
          })
          .map(([docId]) => ({
            data: () => ({ ...store.get(docId) }),
            ref: {
              delete: jest.fn(async () => {
                store.delete(docId);
              }),
            },
          })),
      })),
    })),
  });

  return {
    getFirestore: jest.fn(() => ({
      collection: jest.fn(() => makeCollRef()),
    })),
    // Exposed so tests can reset state between runs
    __getMockStore: () => store,
  };
});

// ── Imports (must come after jest.mock) ───────────────────────────────────────

import {
  createMagicLink,
  verifyMagicLink,
  purgeExpiredTokens,
  clearTokenStore,
  TOKEN_TTL_MS,
} from "./magic-link-store.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getMockStore = (): Map<string, Record<string, unknown>> =>
  (jest.requireMock("firebase-admin/firestore") as any).__getMockStore();

const BASE_URL = "https://example.com";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("magic-link-store", () => {
  beforeEach(async () => {
    getMockStore().clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("createMagicLink", () => {
    it("returns a URL containing the verify endpoint", async () => {
      const link = await createMagicLink("whatsapp:+1234567890", BASE_URL);
      expect(link).toMatch(
        /^https:\/\/example\.com\/api\/magic-link\/verify\?token=[0-9a-f]{64}$/
      );
    });

    it("generates a unique token each call", async () => {
      const link1 = await createMagicLink("whatsapp:+1111111111", BASE_URL);
      const link2 = await createMagicLink("whatsapp:+1111111111", BASE_URL);
      expect(link1).not.toBe(link2);
    });
  });

  describe("verifyMagicLink", () => {
    it("returns the phone number for a valid token", async () => {
      const phone = "whatsapp:+1234567890";
      const link = await createMagicLink(phone, BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;
      expect(await verifyMagicLink(token)).toBe(phone);
    });

    it("returns null for an unknown token", async () => {
      expect(await verifyMagicLink("not-a-real-token")).toBeNull();
    });

    it("returns null and cannot be reused after first verification", async () => {
      const link = await createMagicLink("whatsapp:+1234567890", BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;

      const first = await verifyMagicLink(token);
      expect(first).toBe("whatsapp:+1234567890");

      // Second call with same token must fail (single-use)
      const second = await verifyMagicLink(token);
      expect(second).toBeNull();
    });

    it("returns null for an expired token", async () => {
      const link = await createMagicLink("whatsapp:+1234567890", BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;

      // Advance time past TTL
      jest.advanceTimersByTime(TOKEN_TTL_MS + 1);

      expect(await verifyMagicLink(token)).toBeNull();
    });

    it("returns the phone for a token that has not yet expired", async () => {
      const phone = "whatsapp:+1234567890";
      const link = await createMagicLink(phone, BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;

      // Advance time to just before expiry
      jest.advanceTimersByTime(TOKEN_TTL_MS - 1);

      expect(await verifyMagicLink(token)).toBe(phone);
    });
  });

  describe("purgeExpiredTokens", () => {
    it("removes expired tokens from the store", async () => {
      const link = await createMagicLink("whatsapp:+1234567890", BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;

      jest.advanceTimersByTime(TOKEN_TTL_MS + 1);
      await purgeExpiredTokens();

      // Token no longer in store; verifyMagicLink must also return null
      expect(await verifyMagicLink(token)).toBeNull();
    });

    it("does not remove valid tokens", async () => {
      const phone = "whatsapp:+1234567890";
      const link = await createMagicLink(phone, BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;

      await purgeExpiredTokens(); // Nothing should be purged

      expect(await verifyMagicLink(token)).toBe(phone);
    });
  });

  describe("clearTokenStore", () => {
    it("removes all tokens", async () => {
      const link = await createMagicLink("whatsapp:+1234567890", BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;

      await clearTokenStore();

      expect(await verifyMagicLink(token)).toBeNull();
    });
  });
});
