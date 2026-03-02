import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import type { Expense, ExtractedExpense } from "../types/index.js";

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

export async function writeExpense(
  extracted: ExtractedExpense,
  submittedBy: string,
  rawInputType: "text" | "image"
): Promise<string> {
  const db = getDb();

  const expense: Expense = {
    amount: extracted.amount!,
    currency: extracted.currency,
    merchant: extracted.merchant || "Unknown",
    category: extracted.category || "Other",
    date: extracted.date || new Date().toISOString().split("T")[0],
    submittedBy,
    rawInputType,
    createdAt: Timestamp.now(),
  };

  const docRef = await db.collection("expenses").add(expense);
  console.log(`Expense written with ID: ${docRef.id}`);
  return docRef.id;
}
