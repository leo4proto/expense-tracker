import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import {
  createMagicLink,
  verifyMagicLink,
  purgeExpiredTokens,
  clearTokenStore,
  TOKEN_TTL_MS,
} from "./magic-link-store.js";

const BASE_URL = "https://example.com";

describe("magic-link-store", () => {
  beforeEach(() => {
    clearTokenStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("createMagicLink", () => {
    it("returns a URL containing the verify endpoint", () => {
      const link = createMagicLink("whatsapp:+1234567890", BASE_URL);
      expect(link).toMatch(
        /^https:\/\/example\.com\/api\/magic-link\/verify\?token=[0-9a-f]{64}$/
      );
    });

    it("generates a unique token each call", () => {
      const link1 = createMagicLink("whatsapp:+1111111111", BASE_URL);
      const link2 = createMagicLink("whatsapp:+1111111111", BASE_URL);
      expect(link1).not.toBe(link2);
    });
  });

  describe("verifyMagicLink", () => {
    it("returns the phone number for a valid token", () => {
      const phone = "whatsapp:+1234567890";
      const link = createMagicLink(phone, BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;
      expect(verifyMagicLink(token)).toBe(phone);
    });

    it("returns null for an unknown token", () => {
      expect(verifyMagicLink("not-a-real-token")).toBeNull();
    });

    it("returns null and cannot be reused after first verification", () => {
      const link = createMagicLink("whatsapp:+1234567890", BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;

      const first = verifyMagicLink(token);
      expect(first).toBe("whatsapp:+1234567890");

      // Second call with same token must fail (single-use)
      const second = verifyMagicLink(token);
      expect(second).toBeNull();
    });

    it("returns null for an expired token", () => {
      const link = createMagicLink("whatsapp:+1234567890", BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;

      // Advance time past TTL
      jest.advanceTimersByTime(TOKEN_TTL_MS + 1);

      expect(verifyMagicLink(token)).toBeNull();
    });

    it("returns the phone for a token that has not yet expired", () => {
      const phone = "whatsapp:+1234567890";
      const link = createMagicLink(phone, BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;

      // Advance time to just before expiry
      jest.advanceTimersByTime(TOKEN_TTL_MS - 1);

      expect(verifyMagicLink(token)).toBe(phone);
    });
  });

  describe("purgeExpiredTokens", () => {
    it("removes expired tokens from the store", () => {
      const link = createMagicLink("whatsapp:+1234567890", BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;

      jest.advanceTimersByTime(TOKEN_TTL_MS + 1);
      purgeExpiredTokens();

      // Should no longer be verifiable (was cleaned up)
      expect(verifyMagicLink(token)).toBeNull();
    });

    it("does not remove valid tokens", () => {
      const phone = "whatsapp:+1234567890";
      const link = createMagicLink(phone, BASE_URL);
      const token = new URL(link).searchParams.get("token") as string;

      purgeExpiredTokens(); // Nothing should be purged

      expect(verifyMagicLink(token)).toBe(phone);
    });
  });
});
