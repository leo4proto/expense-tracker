import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import type { ExtractedExpense } from "../types/index.js";

const client = new Anthropic({ apiKey: env.anthropic.apiKey });

const SYSTEM_PROMPT = `You are an expense extraction assistant. Extract expense information from natural language descriptions.

Extract the following fields:
- amount: The numeric amount (without currency symbol)
- currency: The currency code (default to CAD if not specified)
- merchant: The store or service name
- category: The type of expense (e.g., Groceries, Dining, Transportation, Entertainment, Shopping, Utilities, Healthcare, Travel, Education, Personal Care, Home, Subscriptions, Other)
- date: The date of the expense in YYYY-MM-DD format (use today's date if not specified)

Respond with a JSON object containing these fields. For each field, also include a confidence assessment.

Example input: "Coffee $5 at Starbucks"
Example output:
{
  "amount": 5,
  "currency": "CAD",
  "merchant": "Starbucks",
  "category": "Dining",
  "date": null,
  "confidence": {
    "amount": true,
    "merchant": true,
    "category": true,
    "date": false
  }
}

If you cannot extract a field with confidence, set it to null and set its confidence to false.`;

export async function parseExpenseFromText(
  text: string
): Promise<ExtractedExpense> {
  const today = new Date().toISOString().split("T")[0];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today's date is ${today}. Extract expense information from: "${text}"`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  try {
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = content.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim()) as ExtractedExpense;
    return {
      amount: parsed.amount,
      currency: parsed.currency || "CAD",
      merchant: parsed.merchant,
      category: parsed.category,
      date: parsed.date || today,
      confidence: parsed.confidence || {
        amount: parsed.amount !== null,
        merchant: parsed.merchant !== null,
        category: parsed.category !== null,
        date: parsed.date !== null,
      },
    };
  } catch (error) {
    console.error("Failed to parse Claude response:", content.text);
    throw new Error("Failed to parse expense from text");
  }
}
