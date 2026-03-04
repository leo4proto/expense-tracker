import crypto from "crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "../config/env.js";

export interface MagicLinkToken {
  token: string;
  phone: string;
  expiresAt: number; // Unix milliseconds
  used: boolean;
}

export const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

const COLLECTION = "magic_link_tokens";

function getDb() {
  if (getApps().length === 0) {
    const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const credential = credJson
      ? cert(JSON.parse(credJson))
      : cert(process.env.GOOGLE_APPLICATION_CREDENTIALS as string);
    initializeApp({ credential, projectId: env.firebase.projectId });
  }
  return getFirestore();
}

export async function createMagicLink(phone: string, baseUrl: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await getDb()
    .collection(COLLECTION)
    .doc(token)
    .set({ phone, expiresAt: Date.now() + TOKEN_TTL_MS, used: false });
  return `${baseUrl}/api/magic-link/verify?token=${token}`;
}

/**
 * Validates and atomically consumes a magic-link token.
 * Returns the associated phone number on success, or null if the token
 * is unknown, already used, or expired.
 */
export async function verifyMagicLink(token: string): Promise<string | null> {
  const docRef = getDb().collection(COLLECTION).doc(token);
  const doc = await docRef.get();

  if (!doc.exists) return null;

  const data = doc.data() as { phone: string; expiresAt: number; used: boolean };

  if (data.used) {
    await docRef.delete();
    return null;
  }

  if (Date.now() > data.expiresAt) {
    await docRef.delete();
    return null;
  }

  // Consume the token — prevents replay attacks
  await docRef.delete();
  return data.phone;
}

export async function purgeExpiredTokens(): Promise<void> {
  const now = Date.now();
  const snapshot = await getDb().collection(COLLECTION).get();
  await Promise.all(
    snapshot.docs
      .filter(d => (d.data() as { expiresAt: number }).expiresAt < now)
      .map(d => d.ref.delete())
  );
}

/** Exported for testing only — clears the Firestore collection. */
export async function clearTokenStore(): Promise<void> {
  const snapshot = await getDb().collection(COLLECTION).get();
  await Promise.all(snapshot.docs.map(d => d.ref.delete()));
}
