import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import type { ExtractedExpense } from "../types/index.js";

const client = new Anthropic({ apiKey: env.anthropic.apiKey });

const SYSTEM_PROMPT = `You are an expense extraction assistant. Extract expense information from receipt images.

Extract the following fields:
- amount: The total amount (without currency symbol)
- currency: The currency code (default to CAD if not specified)
- merchant: The store or business name
- category: The type of expense (e.g., Groceries, Dining, Transportation, Entertainment, Shopping, Utilities, Healthcare, Travel, Education, Personal Care, Home, Subscriptions, Other)
- date: The date on the receipt in YYYY-MM-DD format

Respond with a JSON object containing these fields. For each field, also include a confidence assessment.

Example output:
{
  "amount": 25.99,
  "currency": "CAD",
  "merchant": "Target",
  "category": "Shopping",
  "date": "2024-03-15",
  "confidence": {
    "amount": true,
    "merchant": true,
    "category": true,
    "date": true
  }
}

If you cannot extract a field with confidence (blurry image, missing info), set it to null and set its confidence to false.`;

export async function extractExpenseFromImage(
  imageUrl: string,
  mediaType: string
): Promise<ExtractedExpense> {
  // Fetch the image and convert to base64
  const response = await fetch(imageUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.twilio.accountSid}:${env.twilio.authToken}`
      ).toString("base64")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const validMediaTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ] as const;
  const normalizedMediaType = validMediaTypes.includes(
    mediaType as (typeof validMediaTypes)[number]
  )
    ? (mediaType as (typeof validMediaTypes)[number])
    : "image/jpeg";

  const today = new Date().toISOString().split("T")[0];

  const claudeResponse = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: normalizedMediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: `Today's date is ${today}. Extract expense information from this receipt image.`,
          },
        ],
      },
    ],
  });

  const content = claudeResponse.content[0];
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
    throw new Error("Failed to extract expense from image");
  }
}
