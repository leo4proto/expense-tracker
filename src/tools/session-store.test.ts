import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import {
  createSession,
  getSession,
  deleteSession,
  clearSessionStore,
  SESSION_TTL_MS,
} from "./session-store.js";

describe("session-store", () => {
  beforeEach(() => {
    clearSessionStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("createSession", () => {
    it("returns a non-empty session ID", () => {
      const id = createSession("whatsapp:+1234567890");
      expect(id).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns a unique ID each call", () => {
      const id1 = createSession("whatsapp:+1111111111");
      const id2 = createSession("whatsapp:+1111111111");
      expect(id1).not.toBe(id2);
    });
  });

  describe("getSession", () => {
    it("returns the phone number for a valid session", () => {
      const phone = "whatsapp:+1234567890";
      const id = createSession(phone);
      expect(getSession(id)).toBe(phone);
    });

    it("returns null for an unknown session ID", () => {
      expect(getSession("not-a-real-session")).toBeNull();
    });

    it("returns null for an expired session", () => {
      const id = createSession("whatsapp:+1234567890");
      jest.advanceTimersByTime(SESSION_TTL_MS + 1);
      expect(getSession(id)).toBeNull();
    });

    it("returns the phone for a session that has not yet expired", () => {
      const phone = "whatsapp:+1234567890";
      const id = createSession(phone);
      jest.advanceTimersByTime(SESSION_TTL_MS - 1);
      expect(getSession(id)).toBe(phone);
    });
  });

  describe("deleteSession", () => {
    it("removes a session so it can no longer be retrieved", () => {
      const id = createSession("whatsapp:+1234567890");
      deleteSession(id);
      expect(getSession(id)).toBeNull();
    });

    it("does not throw when deleting a non-existent session", () => {
      expect(() => deleteSession("ghost-id")).not.toThrow();
    });
  });
});
