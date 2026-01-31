## Architecture Overview — DevX Pulse

**DevX Pulse** is an internal feedback intelligence platform that aggregates product feedback from multiple sources (Discord, Twitter, GitHub Issues, Support Tickets, Community Forums) and uses AI to classify sentiment, assign confidence scores, and generate summaries for Cloudflare PMs.

---

### Cloudflare Products Used

| Product | Binding | Why It Was Chosen |
|---|---|---|
| **Workers** | — | Serves as the entire application runtime — HTTP routing, business logic, and SSR HTML rendering all run at the edge in a single serverless function. No origin server needed. |
| **D1** | `DB` | Relational storage for feedback records. Its SQLite foundation supports the complex filtering, sorting, pagination, and aggregation queries the dashboard relies on (8 filter dimensions, cross-tabulation stats). Indexes on `sentiment`, `user_tier`, `product_area`, `source`, and `confidence` keep queries fast. |
| **Workers AI** | `AI` | Runs `@cf/meta/llama-3-8b-instruct` to analyze each feedback item, extracting sentiment (Negative/Neutral/Positive), a confidence score (0–1), and a one-sentence summary. This eliminates manual triage and enables a human-in-the-loop review queue for low-confidence items (<0.6). |

### Designed but Not Yet Implemented

| Product | Purpose |
|---|---|
| **Queues** | Decouple ingestion from AI processing so `POST /api/feedback` can return `202` immediately and items are processed asynchronously in batches with a dead-letter queue. |
| **Access** | Lock the dashboard and review page behind SSO; scope the ingestion endpoint to service tokens for automated pipelines. |

### Data Flow

```
Client (JSON array)
  │
  ▼
Workers  ──POST /api/feedback──►  Workers AI (Llama 3-8B)
  │                                  │ sentiment, confidence, summary
  │◄─────────────────────────────────┘
  │
  ▼
  D1  (store feedback + AI analysis)
  │
  ▼
Workers  ──GET /──►  SSR Dashboard (Tailwind + Chart.js)
         ──GET /review──►  Human Review Queue
         ──GET /api/stats──►  JSON aggregates
```

Workers acts as the single orchestration layer — it accepts feedback, calls Workers AI for analysis, persists results to D1, and renders the dashboard and review UI via server-side HTML. All three products are bound together in `wrangler.jsonc` and accessed through the `Env` interface in `src/types.ts`.
