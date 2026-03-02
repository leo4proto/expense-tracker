import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { queryExpenses } from "../tools/firestore-reader.js";
import type { ExpenseQueryParams, Expense } from "../types/index.js";

const client = new Anthropic({ apiKey: env.anthropic.apiKey });

interface ParsedQuery {
  startDate: string;
  endDate: string;
  category?: string;
}

async function parseQueryDates(
  text: string,
  today: string
): Promise<ParsedQuery> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: `You are a date parser for an expense query system. Today's date is ${today}.
Parse the user's query and return a JSON object with:
- startDate: start of the requested period (YYYY-MM-DD)
- endDate: end of the requested period (YYYY-MM-DD)
- category: optional expense category if specified (e.g., Groceries, Dining, Transportation)

Examples:
- "yesterday" → startDate: yesterday, endDate: yesterday
- "this month" → startDate: first day of current month, endDate: today
- "last month" → startDate: first day of last month, endDate: last day of last month
- "this week" → startDate: Monday of current week, endDate: today
- "today" → startDate: today, endDate: today

Respond with JSON only, no markdown.`,
    messages: [
      {
        role: "user",
        content: text,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response from Claude");
  }

  return JSON.parse(content.text.trim()) as ParsedQuery;
}

function formatQueryResponse(expenses: Expense[], params: ParsedQuery): string {
  if (expenses.length === 0) {
    return "No expenses found for that period.";
  }

  // Group by currency and sum amounts
  const byCurrency: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const expense of expenses) {
    byCurrency[expense.currency] =
      (byCurrency[expense.currency] || 0) + expense.amount;
    byCategory[expense.category] =
      (byCategory[expense.category] || 0) + expense.amount;
  }

  const totalCount = expenses.length;
  const currencyLines = Object.entries(byCurrency)
    .map(([currency, total]) => `${currency} ${total.toFixed(2)}`)
    .join(", ");

  // If filtered by category, simple response
  if (params.category) {
    return `You spent ${currencyLines} on ${params.category} (${totalCount} transaction${totalCount !== 1 ? "s" : ""}).`;
  }

  // Multi-category breakdown
  const categoryBreakdown = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => {
      const currency = Object.keys(byCurrency)[0] || "CAD";
      return `${cat}: ${amt.toFixed(2)}`;
    })
    .join(", ");

  const isSingleDay = params.startDate === params.endDate;
  const periodLabel = isSingleDay ? `on ${params.startDate}` : `from ${params.startDate} to ${params.endDate}`;

  return `You spent ${currencyLines} ${periodLabel} (${totalCount} transaction${totalCount !== 1 ? "s" : ""}) — ${categoryBreakdown}`;
}

export async function handleExpenseQuery(
  text: string,
  submittedBy: string
): Promise<string> {
  const today = new Date().toISOString().split("T")[0];

  const parsed = await parseQueryDates(text, today);

  const params: ExpenseQueryParams = {
    submittedBy,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    category: parsed.category,
  };

  const expenses = await queryExpenses(params);
  return formatQueryResponse(expenses, parsed);
}
