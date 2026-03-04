import { Router, type Request, type Response } from "express";
import { requireSession } from "../middleware/auth.js";
import { queryExpenses } from "../tools/firestore-reader.js";
import { getUserName } from "../config/phone-map.js";

export interface DateRange {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
}

export interface SummaryResponse {
  total: number;
  currency: string;
  prevTotal: number;
  delta: number;
  deltaPercent: number | null;
  range: string;
  startDate: string;
  endDate: string;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
  percent: number;
}

export interface CategoryResponse {
  items: CategoryBreakdown[];
  grandTotal: number;
  range: string;
}

export interface TransactionRow {
  date: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
}

export interface TransactionsResponse {
  items: TransactionRow[];
  total: number;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0] as string;
}

export function getDateRange(range: string): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toISODate(today);

  switch (range) {
    case "week": {
      const dayOfWeek = today.getDay(); // 0 = Sun
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysFromMonday);

      const prevMonday = new Date(monday);
      prevMonday.setDate(monday.getDate() - 7);
      const prevSunday = new Date(monday);
      prevSunday.setDate(monday.getDate() - 1);

      return {
        startDate: toISODate(monday),
        endDate: todayStr,
        prevStartDate: toISODate(prevMonday),
        prevEndDate: toISODate(prevSunday),
      };
    }

    case "month": {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const prevFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevEnd = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        today.getDate()
      );
      return {
        startDate: toISODate(firstOfMonth),
        endDate: todayStr,
        prevStartDate: toISODate(prevFirst),
        prevEndDate: toISODate(prevEnd),
      };
    }

    case "last_month": {
      const lastMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
      const lastMonthYear =
        today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
      const firstOfLastMonth = new Date(lastMonthYear, lastMonth, 1);
      const lastOfLastMonth = new Date(lastMonthYear, lastMonth + 1, 0);

      const twoMonthsAgoMonth = lastMonth === 0 ? 11 : lastMonth - 1;
      const twoMonthsAgoYear =
        lastMonth === 0 ? lastMonthYear - 1 : lastMonthYear;
      const firstOfTwoMonthsAgo = new Date(twoMonthsAgoYear, twoMonthsAgoMonth, 1);
      const lastOfTwoMonthsAgo = new Date(twoMonthsAgoYear, twoMonthsAgoMonth + 1, 0);

      return {
        startDate: toISODate(firstOfLastMonth),
        endDate: toISODate(lastOfLastMonth),
        prevStartDate: toISODate(firstOfTwoMonthsAgo),
        prevEndDate: toISODate(lastOfTwoMonthsAgo),
      };
    }

    case "ytd": {
      const firstOfYear = new Date(today.getFullYear(), 0, 1);
      const prevYearFirst = new Date(today.getFullYear() - 1, 0, 1);
      const prevYearEnd = new Date(
        today.getFullYear() - 1,
        today.getMonth(),
        today.getDate()
      );
      return {
        startDate: toISODate(firstOfYear),
        endDate: todayStr,
        prevStartDate: toISODate(prevYearFirst),
        prevEndDate: toISODate(prevYearEnd),
      };
    }

    default:
      throw new Error(`Invalid range: ${range}`);
  }
}

const VALID_RANGES = new Set(["week", "month", "last_month", "ytd"]);

const router = Router();

// All expense endpoints require an active session
router.use(requireSession);

/**
 * GET /api/expenses/summary?range=week|month|last_month|ytd
 *
 * Returns total spending for the selected period and a delta vs. the
 * equivalent prior period.
 */
router.get("/summary", async (req: Request, res: Response) => {
  const range = (req.query["range"] as string) || "week";

  if (!VALID_RANGES.has(range)) {
    res.status(400).json({ error: "Invalid range. Use: week, month, last_month, ytd" });
    return;
  }

  const phone = res.locals["userPhone"] as string;
  const submittedBy = getUserName(phone);

  try {
    const dateRange = getDateRange(range);

    const [current, previous] = await Promise.all([
      queryExpenses({
        submittedBy,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      }),
      queryExpenses({
        submittedBy,
        startDate: dateRange.prevStartDate,
        endDate: dateRange.prevEndDate,
      }),
    ]);

    const total = current.reduce((sum, e) => sum + e.amount, 0);
    const prevTotal = previous.reduce((sum, e) => sum + e.amount, 0);
    const delta = total - prevTotal;
    const deltaPercent =
      prevTotal > 0 ? Math.round((delta / prevTotal) * 100 * 10) / 10 : null;

    const response: SummaryResponse = {
      total: Math.round(total * 100) / 100,
      currency: current[0]?.currency ?? "CAD",
      prevTotal: Math.round(prevTotal * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      deltaPercent,
      range,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    };

    res.json(response);
  } catch (error) {
    console.error("Failed to fetch expense summary:", error);
    res.status(500).json({ error: "Failed to fetch expense summary" });
  }
});

/**
 * GET /api/expenses/by-category?range=week|month|last_month|ytd
 *
 * Returns a breakdown of spending per category for the selected period.
 */
router.get("/by-category", async (req: Request, res: Response) => {
  const range = (req.query["range"] as string) || "week";

  if (!VALID_RANGES.has(range)) {
    res.status(400).json({ error: "Invalid range. Use: week, month, last_month, ytd" });
    return;
  }

  const phone = res.locals["userPhone"] as string;
  const submittedBy = getUserName(phone);

  try {
    const dateRange = getDateRange(range);
    const expenses = await queryExpenses({
      submittedBy,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });

    const byCategory = new Map<string, { total: number; count: number }>();
    for (const expense of expenses) {
      const existing = byCategory.get(expense.category) ?? { total: 0, count: 0 };
      byCategory.set(expense.category, {
        total: existing.total + expense.amount,
        count: existing.count + 1,
      });
    }

    const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

    const items: CategoryBreakdown[] = Array.from(byCategory.entries())
      .map(([category, data]) => ({
        category,
        total: Math.round(data.total * 100) / 100,
        count: data.count,
        percent:
          grandTotal > 0
            ? Math.round((data.total / grandTotal) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const response: CategoryResponse = {
      items,
      grandTotal: Math.round(grandTotal * 100) / 100,
      range,
    };

    res.json(response);
  } catch (error) {
    console.error("Failed to fetch category breakdown:", error);
    res.status(500).json({ error: "Failed to fetch category breakdown" });
  }
});

/**
 * GET /api/expenses/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a paginated list of transactions sorted by date descending.
 */
router.get("/transactions", async (req: Request, res: Response) => {
  const from = req.query["from"] as string | undefined;
  const to = req.query["to"] as string | undefined;

  const today = new Date();
  const startDate =
    from ?? toISODate(new Date(today.getFullYear(), today.getMonth(), 1));
  const endDate = to ?? toISODate(today);

  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(endDate)) {
    res.status(400).json({ error: "from and to must be YYYY-MM-DD format" });
    return;
  }

  const phone = res.locals["userPhone"] as string;
  const submittedBy = getUserName(phone);

  try {
    const expenses = await queryExpenses({ submittedBy, startDate, endDate });

    const items: TransactionRow[] = expenses
      .map((e) => ({
        date: e.date,
        merchant: e.merchant,
        category: e.category,
        amount: e.amount,
        currency: e.currency,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const total = Math.round(items.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;

    const response: TransactionsResponse = { items, total };
    res.json(response);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

export default router;
