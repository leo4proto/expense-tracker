import twilio from "twilio";
import { env } from "../config/env.js";

const client = twilio(env.twilio.accountSid, env.twilio.authToken);

export async function sendWhatsAppReply(
  to: string,
  message: string
): Promise<void> {
  try {
    await client.messages.create({
      from: env.twilio.whatsappNumber,
      to,
      body: message,
    });
    console.log(`WhatsApp message sent to ${to}`);
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
    throw error;
  }
}
