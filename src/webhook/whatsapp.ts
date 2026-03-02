import { Router, type Request, type Response } from "express";
import { processExpense } from "../agents/orchestrator.js";
import { sendWhatsAppReply } from "../tools/whatsapp-reply.js";
import type { TwilioWhatsAppPayload } from "../types/index.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const payload = req.body as TwilioWhatsAppPayload;

    console.log("Received WhatsApp message:", {
      from: payload.From,
      body: payload.Body?.substring(0, 100),
      numMedia: payload.NumMedia,
    });

    // Process the expense asynchronously
    const result = await processExpense(payload);

    // Send reply back to user
    await sendWhatsAppReply(payload.From, result.message);

    // Respond to Twilio with empty TwiML (we're sending reply separately)
    res.type("text/xml").send("<Response></Response>");
  } catch (error) {
    console.error("Webhook error:", error);

    // Try to send error message to user if we have their number
    const payload = req.body as TwilioWhatsAppPayload;
    if (payload?.From) {
      try {
        await sendWhatsAppReply(
          payload.From,
          "Sorry, something went wrong. Please try again later."
        );
      } catch (replyError) {
        console.error("Failed to send error reply:", replyError);
      }
    }

    // Still respond to Twilio to prevent retries
    res.type("text/xml").send("<Response></Response>");
  }
});

export default router;
