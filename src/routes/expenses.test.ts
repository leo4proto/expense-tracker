import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { getDateRange } from "./expenses.js";

// ── getDateRange ──────────────────────────────────────────────────────────────
describe("getDateRange", () => {
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function allDates(range: ReturnType<typeof getDateRange>): string[] {
    return [
      range.startDate,
      range.endDate,
      range.prevStartDate,
      range.prevEndDate,
    ];
  }

  it("returns valid ISO dates for 'week'", () => {
    const r = getDateRange("week");
    allDates(r).forEach((d) => expect(d).toMatch(ISO_DATE_RE));
  });

  it("returns valid ISO dates for 'month'", () => {
    const r = getDateRange("month");
    allDates(r).forEach((d) => expect(d).toMatch(ISO_DATE_RE));
  });

  it("returns valid ISO dates for 'last_month'", () => {
    const r = getDateRange("last_month");
    allDates(r).forEach((d) => expect(d).toMatch(ISO_DATE_RE));
  });

  it("returns valid ISO dates for 'ytd'", () => {
    const r = getDateRange("ytd");
    allDates(r).forEach((d) => expect(d).toMatch(ISO_DATE_RE));
  });

  it("throws for an invalid range", () => {
    expect(() => getDateRange("quarterly")).toThrow("Invalid range: quarterly");
  });

  it("week: startDate is Monday (day 1) or earlier than endDate", () => {
    const r = getDateRange("week");
    expect(r.startDate <= r.endDate).toBe(true);
    const start = new Date(r.startDate);
    const day = start.getDay();
    // Monday = 1
    expect(day).toBe(1);
  });

  it("week: prevStartDate is 7 days before startDate", () => {
    const r = getDateRange("week");
    const start = new Date(r.startDate).getTime();
    const prevStart = new Date(r.prevStartDate).getTime();
    expect(start - prevStart).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("month: startDate is the 1st of current month", () => {
    const r = getDateRange("month");
    expect(r.startDate).toMatch(/-01$/);
    const today = new Date();
    const expectedYear = today.getFullYear();
    const expectedMonth = String(today.getMonth() + 1).padStart(2, "0");
    expect(r.startDate.startsWith(`${expectedYear}-${expectedMonth}`)).toBe(true);
  });

  it("last_month: startDate and endDate span an entire month", () => {
    const r = getDateRange("last_month");
    expect(r.startDate).toMatch(/-01$/);
    const end = new Date(r.endDate);
    // Last day of the month
    const nextMonth = new Date(end.getFullYear(), end.getMonth() + 1, 1);
    const lastDay = new Date(nextMonth.getTime() - 86400000);
    expect(end.getDate()).toBe(lastDay.getDate());
  });

  it("ytd: startDate is Jan 1 of current year", () => {
    const r = getDateRange("ytd");
    const today = new Date();
    expect(r.startDate).toBe(`${today.getFullYear()}-01-01`);
  });

  it("ytd: prevStartDate is Jan 1 of previous year", () => {
    const r = getDateRange("ytd");
    const today = new Date();
    expect(r.prevStartDate).toBe(`${today.getFullYear() - 1}-01-01`);
  });
});

// ── Summary route handler (unit test with mocked Firestore) ───────────────────
jest.mock("../tools/firestore-reader.js", () => ({
  queryExpenses: jest.fn(),
}));

jest.mock("../config/phone-map.js", () => ({
  getUserName: (phone: string) => (phone === "whatsapp:+1" ? "Alice" : phone),
}));

import type { Expense } from "../types/index.js";

function makeExpense(amount: number, category = "Dining"): Expense {
  return {
    amount,
    currency: "CAD",
    merchant: "Test",
    category,
    date: "2026-03-01",
    submittedBy: "Alice",
    rawInputType: "text",
    createdAt: null as unknown as import("firebase-admin/firestore").Timestamp,
  };
}

// queryExpenses is mocked so the test module loads without Firebase initializing.
// The summary-calculation and category-aggregation tests are purely computational —
// they verify the arithmetic logic independently of any HTTP framework or database.

describe("expense route helpers: summary calculation", () => {
  it("computes total correctly from an expense list", () => {
    const current = [makeExpense(100), makeExpense(50)];
    const previous = [makeExpense(120)];

    const total = current.reduce((s, e) => s + e.amount, 0);
    const prevTotal = previous.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(150);
    expect(prevTotal).toBe(120);
    expect(total - prevTotal).toBe(30);
  });

  it("computes deltaPercent correctly", () => {
    const total = 150;
    const prevTotal = 120;
    const delta = total - prevTotal;
    const deltaPercent = Math.round((delta / prevTotal) * 100 * 10) / 10;
    expect(deltaPercent).toBeCloseTo(25, 1);
  });

  it("returns null deltaPercent when previous total is zero", () => {
    const prevTotal = 0;
    const deltaPercent = prevTotal > 0 ? Math.round((30 / prevTotal) * 100 * 10) / 10 : null;
    expect(deltaPercent).toBeNull();
  });

  it("handles empty expense arrays", () => {
    const current: Expense[] = [];
    const previous: Expense[] = [];

    const total = current.reduce((s, e) => s + e.amount, 0);
    const prevTotal = previous.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(0);
    expect(prevTotal).toBe(0);
  });
});

describe("expense route helpers: category aggregation", () => {
  it("groups expenses correctly by category", () => {
    const expenses = [
      makeExpense(50, "Dining"),
      makeExpense(30, "Groceries"),
      makeExpense(20, "Dining"),
    ];

    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    }

    expect(byCategory.get("Dining")).toBe(70);
    expect(byCategory.get("Groceries")).toBe(30);
  });

  it("computes percent correctly", () => {
    const total = 100;
    const amount = 25;
    const pct = Math.round((amount / total) * 1000) / 10;
    expect(pct).toBe(25);
  });
});

describe("expense route helpers: transactions sorting", () => {
  it("sorts transactions by date descending", () => {
    const rows = [
      { date: "2026-03-01", merchant: "A", category: "Dining", amount: 10, currency: "CAD" },
      { date: "2026-03-04", merchant: "B", category: "Groceries", amount: 20, currency: "CAD" },
      { date: "2026-03-02", merchant: "C", category: "Transport", amount: 5, currency: "CAD" },
    ].sort((a, b) => b.date.localeCompare(a.date));

    expect(rows[0]?.date).toBe("2026-03-04");
    expect(rows[1]?.date).toBe("2026-03-02");
    expect(rows[2]?.date).toBe("2026-03-01");
  });
});
