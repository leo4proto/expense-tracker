import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const env = {
  port: parseInt(optionalEnv("PORT", "3000"), 10),
  baseUrl: optionalEnv("BASE_URL", ""),
  twilio: {
    accountSid: requireEnv("TWILIO_ACCOUNT_SID"),
    authToken: requireEnv("TWILIO_AUTH_TOKEN"),
    whatsappNumber: requireEnv("TWILIO_WHATSAPP_NUMBER"),
  },
  anthropic: {
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
  },
  firebase: {
    projectId: requireEnv("FIRESTORE_PROJECT_ID"),
  },
  phoneMap: optionalEnv("PHONE_MAP", "{}"),
} as const;
