import { parseExpenseFromText } from "./text-parser.js";
import { extractExpenseFromImage } from "./image-extractor.js";
import { handleExpenseQuery } from "./query-handler.js";
import {
  normalizeCategory,
  getSuggestedCategories,
} from "../tools/category-normalizer.js";
import { writeExpense } from "../tools/firestore-writer.js";
import { getUserName } from "../config/phone-map.js";
import type {
  TwilioWhatsAppPayload,
  OrchestratorResult,
  ExtractedExpense,
} from "../types/index.js";

const QUERY_INTENT_REGEX =
  /^(how much|what did|show|total|spent on|summary|report|did i spend)/i;
const QUERY_KEYWORDS_REGEX =
  /\b(yesterday|this month|last month|this week|last week|today)\b/i;
const HAS_AMOUNT_REGEX = /\$[\d.,]+|\d+[\d.,]*\s*(dollars?|cad|usd)/i;

function isExpenseQuery(text: string): boolean {
  if (QUERY_INTENT_REGEX.test(text)) return true;
  if (QUERY_KEYWORDS_REGEX.test(text) && !HAS_AMOUNT_REGEX.test(text))
    return true;
  return false;
}

export async function processExpense(
  payload: TwilioWhatsAppPayload
): Promise<OrchestratorResult> {
  const hasMedia = parseInt(payload.NumMedia, 10) > 0;
  const submittedBy = getUserName(payload.From);

  // Route to query handler if the message looks like a spending question
  if (!hasMedia && payload.Body && isExpenseQuery(payload.Body)) {
    try {
      const queryResponse = await handleExpenseQuery(
        payload.Body,
        submittedBy
      );
      return { success: true, message: queryResponse };
    } catch (error) {
      console.error("Query handler error:", error);
      return {
        success: false,
        message: "Sorry, I had trouble looking up your expenses. Please try again.",
      };
    }
  }

  let extracted: ExtractedExpense;
  let rawInputType: "text" | "image";

  try {
    if (hasMedia && payload.MediaUrl0 && payload.MediaContentType0) {
      // Process image
      extracted = await extractExpenseFromImage(
        payload.MediaUrl0,
        payload.MediaContentType0
      );
      rawInputType = "image";
    } else if (payload.Body && payload.Body.trim()) {
      // Process text
      extracted = await parseExpenseFromText(payload.Body);
      rawInputType = "text";
    } else {
      return {
        success: false,
        message:
          "Please send an expense description or a receipt image. Example: 'Coffee $5 at Starbucks'",
      };
    }

    // Check for missing critical fields
    if (!extracted.amount || !extracted.confidence.amount) {
      return {
        success: false,
        needsClarification: true,
        clarificationPrompt:
          "I couldn't determine the amount. Please reply with the expense amount.",
        message:
          "I couldn't determine the amount. Please reply with the expense amount (e.g., '$25.50').",
      };
    }

    if (!extracted.merchant || !extracted.confidence.merchant) {
      return {
        success: false,
        needsClarification: true,
        clarificationPrompt:
          "I couldn't determine the merchant. Please reply with the store or business name.",
        message:
          "I couldn't determine where this expense was made. Please reply with the merchant name.",
      };
    }

    // Normalize category
    const normalizedCategory = normalizeCategory(extracted.category);
    if (!normalizedCategory) {
      return {
        success: false,
        needsClarification: true,
        clarificationPrompt: `Please specify a category for this expense.`,
        message: `I recorded $${extracted.amount} at ${extracted.merchant}, but I need a category. Please choose from: ${getSuggestedCategories()}`,
      };
    }
    extracted.category = normalizedCategory;

    // Write to Firestore
    const docId = await writeExpense(extracted, submittedBy, rawInputType);

    const formattedAmount = `${extracted.currency} ${extracted.amount.toFixed(2)}`;
    return {
      success: true,
      message: `✓ Recorded: ${formattedAmount} at ${extracted.merchant} (${extracted.category}) on ${extracted.date}`,
      expense: {
        amount: extracted.amount,
        currency: extracted.currency,
        merchant: extracted.merchant!,
        category: extracted.category,
        date: extracted.date || new Date().toISOString().split("T")[0],
        submittedBy,
        rawInputType,
        createdAt: null as any, // Will be set by Firestore
      },
    };
  } catch (error) {
    console.error("Orchestrator error:", error);
    return {
      success: false,
      message:
        "Sorry, I had trouble processing that. Please try again or send a clearer image.",
    };
  }
}
