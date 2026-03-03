# CLAUDE.md — Expense Tracker Agent

This file instructs Claude Code on how to work autonomously in this repository.
Read it fully before taking any action on an issue or task.

---

## Project Overview

A WhatsApp-triggered expense tracking agent. Users send a text or photo of a receipt
via WhatsApp; the agent extracts structured data and writes it to Firebase Firestore.

**Stack:**
- Runtime: Node.js + TypeScript
- Framework: Express.js
- WhatsApp: Twilio WhatsApp API (webhook-based)
- LLM + Vision: Anthropic Claude (claude-sonnet-4-6)
- Database: Firebase Firestore
- Deployment: Render (build: `npm run build`, start: `npm start`)
- Package manager: npm

---

## Autonomous Workflow

When assigned a GitHub issue, follow this process without waiting for confirmation:

1. Read the issue fully, including all comments and linked context
2. Create a feature branch: `git checkout -b feat/issue-{number}-{short-slug}`
3. Implement the solution following all conventions in this file
4. Write or update tests to cover the change
5. Ensure `npm run build` and `npm test` pass with zero errors
6. Commit with a conventional commit message (see below)
7. Open a pull request using the PR template — do not merge

If the issue is genuinely ambiguous and cannot be reasonably inferred from context,
leave a comment on the issue asking for clarification before proceeding.

---

## Project Structure

```
src/
├── webhook/        # Twilio webhook handler (entry point)
├── agents/         # orchestrator, image-extractor, text-parser
├── tools/          # category-normalizer, firestore-writer, whatsapp-reply
├── config/         # env vars, category list, phone-to-user map
└── types/          # shared TypeScript interfaces
```

---

## TypeScript Conventions

- Strict mode is enabled (`"strict": true` in tsconfig). Never use `any`.
- Use `interface` for object shapes, `type` for unions and aliases.
- All functions must have explicit return types.
- Prefer `async/await` over raw Promises. Never use `.then()` chains.
- Use named exports. Avoid default exports except for Express router files.
- Group imports: Node built-ins → third-party → internal (`../`) → types.
- No unused variables or imports — treat them as errors.

```typescript
// Good
export async function parseExpense(input: string): Promise<ExpenseData> { ... }

// Bad
export default async function(input) { ... }
```

---

## Naming Conventions

- Files: `kebab-case.ts`
- Variables and functions: `camelCase`
- Types and interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Branch names: `feat/issue-{number}-{short-slug}` or `fix/issue-{number}-{short-slug}`

---

## Expense Schema

All expenses written to Firestore must conform to this exact shape:

```typescript
interface ExpenseData {
  amount: number;
  currency: string;        // default: "CAD"
  merchant: string;
  category: ExpenseCategory;
  date: string;            // ISO 8601 format (YYYY-MM-DD), default to today
  submittedBy: string;     // resolved from PHONE_MAP env var
  rawInputType: "text" | "image";
  createdAt: FirebaseFirestore.Timestamp;
}
```

---

## Canonical Categories

Only these values are valid for `category`. Never invent new ones:

```
Groceries | Restaurants | Coffee | Transport | Gas | Utilities |
Subscriptions | Shopping | Health | Entertainment | Travel | Other
```

---

## Error Handling Rules

- Wrap all agent calls and external API calls in `try/catch`.
- On any unhandled error: reply to WhatsApp with `"⚠️ Something went wrong. Please try again."` and log the full error to console with context.
- Never swallow errors silently.
- Never throw generic `Error` — use descriptive messages: `throw new Error("Failed to write to Firestore: missing amount field")`.

---

## Testing Requirements

- Use **Jest** for all tests.
- Every new function in `agents/` and `tools/` must have a corresponding unit test.
- Mock all external services (Twilio, Firestore, Anthropic API) — never call real APIs in tests.
- Test file naming: `{filename}.test.ts` co-located with the source file.
- Tests must cover: happy path, missing fields, malformed input, and error states.
- All tests must pass before opening a PR: `npm test`.

```typescript
// Example test structure
describe("parseExpense", () => {
  it("extracts amount and merchant from plain text", async () => { ... });
  it("defaults category to Other when unrecognized", async () => { ... });
  it("throws when amount is missing", async () => { ... });
});
```

---

## Build & Deployment

The app deploys to **Render**. The build pipeline runs:

```
npm install
npm run build    # tsc — compiles src/ to dist/
npm start        # node dist/index.js
```

- Never commit changes that break `npm run build`.
- Never import files using `.ts` extensions — use `.js` in compiled output paths if needed.
- All environment variables are injected by Render at runtime — never hardcode secrets.
- Required env vars (must be present or app will not start):
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`,
  `ANTHROPIC_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`,
  `FIREBASE_CLIENT_EMAIL`, `PHONE_MAP`

---

## Git Conventions

**Commit messages** must follow Conventional Commits:

```
feat: add image extraction agent
fix: handle missing date field in text parser
test: add unit tests for category normalizer
chore: update dependencies
```

**PR titles** must match the commit format.
**PR body** must reference the issue: `Closes #123`.

---

## What Claude Should NOT Do

- Do not merge PRs — always leave them for human review.
- Do not modify `.env` or `.env.example` unless the issue explicitly asks for it.
- Do not change `tsconfig.json` or `package.json` scripts without a clear reason stated in the PR.
- Do not add new npm dependencies without noting the justification in the PR description.
- Do not write `console.log` for debugging — use `console.error` for errors only.
