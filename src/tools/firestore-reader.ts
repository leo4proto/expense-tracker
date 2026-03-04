import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import type { Expense, ExpenseQueryParams } from "../types/index.js";

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

export async function queryExpenses(
  params: ExpenseQueryParams
): Promise<Expense[]> {
  const db = getDb();

  let query: FirebaseFirestore.Query = db
    .collection("expenses")
    .where("date", ">=", params.startDate)
    .where("date", "<=", params.endDate);

  if (params.submittedBy) {
    query = query.where("submittedBy", "==", params.submittedBy);
  }

  if (params.category) {
    query = query.where("category", "==", params.category);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => doc.data() as Expense);
}
