import crypto from "crypto";

export interface Session {
  sessionId: string;
  phone: string;
  expiresAt: number;
}

export const SESSION_COOKIE_NAME = "expense_session";
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

// In-memory store: sessionId -> Session
const sessionStore = new Map<string, Session>();

export function createSession(phone: string): string {
  const sessionId = crypto.randomBytes(32).toString("hex");
  sessionStore.set(sessionId, {
    sessionId,
    phone,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return sessionId;
}

/**
 * Looks up a session by ID.
 * Returns the associated phone number, or null if the session is
 * unknown or expired.
 */
export function getSession(sessionId: string): string | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(sessionId);
    return null;
  }
  return session.phone;
}

export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
}

/** Exported for testing only — clears the in-memory store. */
export function clearSessionStore(): void {
  sessionStore.clear();
}
