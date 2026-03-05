# HoneyJar — Media Matching MVP

Find the best reporters for your story. Paste a brief, answer a few questions, get a ranked media list with explanations.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Google AI Studio API key ([get one here](https://aistudio.google.com/apikey))
- AWS credentials with S3 Vectors access

## Quick Start

```bash
# 1. Clone and enter the project
cd honeyjar

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your GOOGLE_API_KEY, AWS credentials, etc.

# 3. Start everything
make dev

# 4. Seed the database with sample articles (in a separate terminal)
make seed

# 5. Open the UI
open http://localhost:5173
```

## Environment Variables

| Variable                | Required | Description                                          |
| ----------------------- | -------- | ---------------------------------------------------- |
| `GOOGLE_API_KEY`        | Yes      | Google AI Studio API key                             |
| `AWS_ACCESS_KEY_ID`     | Yes      | AWS access key                                       |
| `AWS_SECRET_ACCESS_KEY` | Yes      | AWS secret key                                       |
| `AWS_REGION`            | No       | AWS region (default: `us-east-1`)                    |
| `S3V_BUCKET_NAME`       | No       | S3 Vectors bucket name (default: `honeyjar-vectors`) |
| `S3V_INDEX_NAME`        | No       | S3 Vectors index name (default: `articles`)          |
| `GEMINI_MODEL`          | No       | Gemini model for chat (default: `gemini-2.0-flash`)  |
| `NEWSAPI_KEY`           | No       | NewsAPI key for live article ingestion               |
| `PORT`                  | No       | Backend port (default: `3001`)                       |

## Make Targets

| Command      | Description                                 |
| ------------ | ------------------------------------------- |
| `make dev`   | Start backend + frontend via Docker Compose |
| `make seed`  | Ingest seed articles into S3 Vectors        |
| `make test`  | Run backend tests                           |
| `make build` | Build Docker images                         |
| `make clean` | Tear down containers and volumes            |

## How It Works

1. **Paste a story brief** into the chat
2. **Answer clarifying questions** — select outlet types (national, trade, etc.) and geography
3. **Get ranked reporters** — each with an explanation, relevant articles, and contact info
4. **Refine** — type commands like "only trades" or "favor climate tech"
5. **Export** — download CSV or copy email addresses

## Architecture

```
Frontend (React + Vite + Tailwind)
    ↓ REST API
Backend (Express + TypeScript)
    ├── Gemini (chat + explanations)
    ├── HuggingFace (embeddings, local)
    ├── AWS S3 Vectors (semantic search)
    ├── SQLite (sessions, reporters, articles)
    └── NewsAPI / RSS / URL (ingestion)
```

## Article Ingestion

Three ingestion methods:

- **NewsAPI**: `POST /api/ingest/newsapi` with `{ "query": "battery technology" }`
- **RSS**: `POST /api/ingest/rss` with `{ "feedUrl": "https://..." }`
- **URL**: `POST /api/ingest/url` with `{ "url": "https://..." }`

Seed data includes ~60 articles across three verticals: Battery/EV, Restaurant Robotics, and Fintech/Cloud. NewsAPI ingestion sets reporter geography from the Sources API (outlet country) or a static fallback.

## API Endpoints

| Method | Path                              | Description               |
| ------ | --------------------------------- | ------------------------- |
| `POST` | `/api/chat/sessions`              | Create new chat session   |
| `GET`  | `/api/chat/sessions/:id`          | Get session state         |
| `POST` | `/api/chat/sessions/:id/messages` | Send a message            |
| `POST` | `/api/ingest/newsapi`             | Ingest from NewsAPI       |
| `POST` | `/api/ingest/rss`                 | Ingest from RSS feed      |
| `POST` | `/api/ingest/url`                 | Ingest single article URL |
| `GET`  | `/api/export/:sessionId/csv`      | Download CSV media list   |
| `GET`  | `/api/export/:sessionId/emails`   | Get copy-pasteable emails |
| `GET`  | `/api/health`                     | Health check              |

## Development (without Docker)

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to the backend at `localhost:3001`.
