import type { Timestamp } from "firebase-admin/firestore";

export interface Expense {
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  date: string;
  submittedBy: string;
  rawInputType: "text" | "image";
  createdAt: Timestamp;
}

export interface ExtractedExpense {
  amount: number | null;
  currency: string;
  merchant: string | null;
  category: string | null;
  date: string | null;
  confidence: {
    amount: boolean;
    merchant: boolean;
    category: boolean;
    date: boolean;
  };
}

export interface TwilioWhatsAppPayload {
  From: string;
  Body: string;
  NumMedia: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

export interface OrchestratorResult {
  success: boolean;
  message: string;
  expense?: Expense;
  needsClarification?: boolean;
  clarificationPrompt?: string;
}

export interface ExpenseQueryParams {
  submittedBy: string;
  startDate: string;
  endDate: string;
  category?: string;
}
