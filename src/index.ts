import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { env } from "./config/env.js";
import whatsappWebhook from "./webhook/whatsapp.js";
import { requestLogger } from "./middleware/request-logger.js";
import expensesRouter from "./routes/expenses.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const app = express();

// Parse URL-encoded bodies (Twilio sends form data)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// WhatsApp webhook
app.use("/webhook/whatsapp", whatsappWebhook);

// Expense data API routes
app.use("/api/expenses", expensesRouter);

// Dashboard page
app.get("/dashboard", (_req, res) => {
  res.sendFile(path.join(publicDir, "dashboard.html"));
});

// Transactions page
app.get("/transactions", (_req, res) => {
  res.sendFile(path.join(publicDir, "transactions.html"));
});

// Error handling middleware
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(env.port, () => {
  console.log(`Expense agent listening on port ${env.port}`);
  console.log(`Health check: http://localhost:${env.port}/health`);
  console.log(`Webhook: http://localhost:${env.port}/webhook/whatsapp`);
});
