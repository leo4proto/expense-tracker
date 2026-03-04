import crypto from "crypto";

export interface MagicLinkToken {
  token: string;
  phone: string;
  expiresAt: number;
  used: boolean;
}

export const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

// In-memory store: token -> MagicLinkToken
const tokenStore = new Map<string, MagicLinkToken>();

export function createMagicLink(phone: string, baseUrl: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const entry: MagicLinkToken = {
    token,
    phone,
    expiresAt: Date.now() + TOKEN_TTL_MS,
    used: false,
  };
  tokenStore.set(token, entry);
  return `${baseUrl}/api/magic-link/verify?token=${token}`;
}

/**
 * Validates and atomically consumes a magic-link token.
 * Returns the associated phone number on success, or null if the token
 * is unknown, already used, or expired.
 *
 * Node.js is single-threaded, so the Map read-modify-delete is atomic.
 */
export function verifyMagicLink(token: string): string | null {
  const entry = tokenStore.get(token);
  if (!entry) return null;
  if (entry.used) {
    tokenStore.delete(token);
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(token);
    return null;
  }
  // Mark as used and remove — prevents replay attacks
  entry.used = true;
  tokenStore.delete(token);
  return entry.phone;
}

export function purgeExpiredTokens(): void {
  const now = Date.now();
  for (const [token, entry] of tokenStore.entries()) {
    if (now > entry.expiresAt) {
      tokenStore.delete(token);
    }
  }
}

/** Exported for testing only — clears the in-memory store. */
export function clearTokenStore(): void {
  tokenStore.clear();
}
