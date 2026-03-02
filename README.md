# WhatsApp Expense Tracking Agent

A stateless WhatsApp expense tracker using Node.js, TypeScript, Express, Twilio, Claude AI, and Firebase Firestore.

## Features

- **Text-based expense logging**: Send natural language descriptions like "Coffee $5 at Starbucks"
- **Receipt image scanning**: Send photos of receipts for automatic extraction
- **Smart categorization**: Automatic category detection with fuzzy matching
- **Multi-user support**: Track expenses per phone number with configurable user mapping

## Setup

### Prerequisites

- Node.js 18+
- A Twilio account with WhatsApp sandbox or production number
- An Anthropic API key
- A Firebase project with Firestore enabled

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | Your Twilio WhatsApp number (e.g., `whatsapp:+14155238886`) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON |
| `FIRESTORE_PROJECT_ID` | Your Firebase project ID |
| `PHONE_MAP` | JSON mapping of phone numbers to user names |

### Phone Map Format

```json
{
  "whatsapp:+1234567890": "John",
  "whatsapp:+0987654321": "Jane"
}
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Webhook Setup

1. Deploy the application to a publicly accessible URL
2. In Twilio Console, configure your WhatsApp number's webhook:
   - URL: `https://your-domain.com/webhook/whatsapp`
   - Method: POST

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/webhook/whatsapp` | POST | Twilio WhatsApp webhook |

## Categories

Supported expense categories:
- Groceries
- Dining
- Transportation
- Entertainment
- Shopping
- Utilities
- Healthcare
- Travel
- Education
- Personal Care
- Home
- Subscriptions
- Other

## Firestore Schema

Expenses are stored in the `expenses` collection:

```typescript
{
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  date: string;          // YYYY-MM-DD
  submittedBy: string;   // User name or phone number
  rawInputType: "text" | "image";
  createdAt: Timestamp;
}
```

## Usage Examples

**Text input:**
```
Coffee $5 at Starbucks
Uber ride $25
Groceries 150 at Whole Foods
```

**Image input:**
Send a photo of any receipt.

## Architecture

```
src/
├── index.ts                 # Express entry point
├── webhook/
│   └── whatsapp.ts          # Twilio webhook handler
├── agents/
│   ├── orchestrator.ts      # Routes messages to extractors
│   ├── image-extractor.ts   # Claude vision for receipts
│   └── text-parser.ts       # Claude text for descriptions
├── tools/
│   ├── category-normalizer.ts
│   ├── firestore-writer.ts
│   └── whatsapp-reply.ts
├── config/
│   ├── env.ts
│   ├── categories.ts
│   └── phone-map.ts
└── types/
    └── index.ts
```
