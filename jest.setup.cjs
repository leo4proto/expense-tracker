// Set required environment variables before any test modules are loaded.
// This prevents errors from env.ts's requireEnv() during tests.
process.env.TWILIO_ACCOUNT_SID = "test_account_sid";
process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
process.env.TWILIO_WHATSAPP_NUMBER = "whatsapp:+15551234567";
process.env.ANTHROPIC_API_KEY = "test_anthropic_key";
process.env.FIRESTORE_PROJECT_ID = "test-project";
process.env.BASE_URL = "https://example.com";
process.env.PHONE_MAP = JSON.stringify({ "whatsapp:+1234567890": "Alice" });
