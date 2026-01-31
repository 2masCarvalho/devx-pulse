## How the Application Works

### Purpose

DevX Pulse is an internal feedback intelligence dashboard. It ingests raw customer feedback from five channels (Support Tickets, Discord, GitHub Issues, Twitter, Community Forum), runs each item through an AI model for automated sentiment analysis, and presents the results in a filterable dashboard so PMs can prioritize what matters most.

---

### Ingestion Pipeline (`POST /api/feedback`)

1. The client sends a JSON array of feedback items. Each item carries four fields: `source`, `user_tier`, `product_area`, and `content` (the raw text).
2. Items without a non-empty `content` string are silently dropped.
3. Each valid item is sent to **Workers AI** (`@cf/meta/llama-3-8b-instruct`) with a structured prompt that requests three fields back as JSON:
   - **Sentiment** — one of `Negative`, `Neutral`, or `Positive`
   - **Confidence** — a float from 0.0 to 1.0
   - **Summary** — a one-sentence description of the feedback
4. The AI call has **retry logic**: up to 3 attempts with exponential backoff (500ms, 1s, 2s). If all retries fail, the item is stored with sentiment `Unknown`, confidence `0`, and a failure message as the summary.
5. The AI response is defensively parsed (`ai.ts:44-73`):
   - A regex extracts the first JSON object from the response text (the model sometimes wraps it in extra text).
   - Sentiment is validated against the three allowed values; anything else becomes `Unknown`.
   - Confidence is normalized — if the model returns a string, a percentage (e.g. `85`), or a number > 1, it's clamped to the 0–1 range.
6. The parsed result is inserted into D1 alongside the original metadata.

---

### What Makes Feedback "Critical"

A feedback item is classified as **critical** when both conditions are true:

```
user_tier = 'Enterprise'  AND  sentiment = 'Negative'
```

This is defined in `db.ts:34-36` inside `buildWhereClause`:

```ts
if (filters.critical) {
    conditions.push("user_tier = 'Enterprise' AND sentiment = 'Negative'");
}
```

**Why this definition:** Enterprise customers represent the highest-revenue tier. Negative feedback from them signals a potential churn risk or SLA violation — problems that have direct financial impact. Negative feedback from Free or Pro users is still tracked, but it doesn't carry the same urgency. The dashboard counts these items in a dedicated "Enterprise Critical" stat card (`db.ts:92`) and highlights them visually with a red background row and a warning triangle icon (`templates.ts:272-279`).

---

### Enterprise-First Sorting

Regardless of whatever sort column the user picks, **Enterprise feedback always floats to the top**. The ORDER BY clause in `db.ts:53` prepends:

```sql
ORDER BY (CASE WHEN user_tier = 'Enterprise' THEN 0 ELSE 1 END) ASC, {sortCol} {sortDir}
```

This ensures PMs see the most revenue-relevant items first in every view.

---

### Low-Confidence & the Review Queue

Items where the AI's confidence score is below **0.6 (60%)** are considered low-confidence. These are:

- Counted in the "Needs Review" stat card on the dashboard (`db.ts:93`)
- Flagged with an amber warning icon in the table (`templates.ts:291`)
- Surfaced in a dedicated **Review Queue** page (`GET /review`)

The review queue (`db.ts:130-155`) shows only items where:

```sql
confidence IS NOT NULL AND confidence < 0.6 AND human_sentiment IS NULL
```

Items are sorted by confidence ascending (least confident first), with Enterprise items prioritized within that ordering. This means the most uncertain, highest-value items appear at the top of the review queue.

---

### Human-in-the-Loop Corrections

PMs can override the AI's sentiment classification via the review page. Clicking "Negative", "Neutral", or "Positive" on a review card sends a `PATCH /api/feedback/:id` request that writes the correction to the `human_sentiment` column.

Key behaviors:

- The original AI sentiment is **never overwritten** — it stays in the `sentiment` column. The human correction goes into `human_sentiment`.
- Once corrected, the item disappears from the review queue (the query filters on `human_sentiment IS NULL`).
- In the dashboard table, corrected items display the human sentiment with a pencil icon; hovering shows the original AI classification (`templates.ts:287`).

---

### Dashboard Statistics (`GET /api/stats`)

The stats endpoint runs 6 parallel queries against D1 (`db.ts:80-95`):

| Stat | Query |
|---|---|
| Total / Negative / Positive / Neutral / Unknown | `COUNT` + conditional `SUM` on the full table |
| By product area | `GROUP BY product_area` |
| By sentiment | `GROUP BY sentiment` |
| Enterprise critical count | `WHERE user_tier = 'Enterprise' AND sentiment = 'Negative'` |
| Low confidence count | `WHERE confidence < 0.6` |
| Product x Sentiment cross-tab | `GROUP BY product_area, sentiment` |

All queries respect the current filter state, so the stats update as the user narrows the view.

---

### Filtering & Search

The dashboard supports 8 filter dimensions (`db.ts:14-44`):

| Filter | Type | Behavior |
|---|---|---|
| `source` | Dropdown | Exact match against valid sources |
| `user_tier` | Dropdown | Exact match against valid tiers |
| `product_area` | Dropdown | Exact match against valid product areas |
| `sentiment` | Dropdown | Exact match against valid sentiments |
| `critical` | Toggle | Shortcut for Enterprise + Negative |
| `search` | Text input | `LIKE %term%` against both `content` and `ai_analysis` |
| `sort_by` | Column header click | Any of: id, source, user_tier, product_area, sentiment, confidence, created_at |
| `sort_order` | Toggle on click | ASC/DESC, defaults to DESC |

All filter values are validated against the `VALID_*` constants before being included in SQL — arbitrary strings are silently ignored, preventing injection.

---

### Pagination

Results are paginated at 15 items per page by default (configurable up to 100 via `per_page` query param). The pagination logic in `db.ts:55-56` clamps values:

```ts
const page = Math.max(1, filters.page || 1);
const perPage = Math.min(100, Math.max(1, filters.per_page || DEFAULT_PER_PAGE));
```

---

### Valid Domain Values

The application enforces fixed enums for all categorical fields (`types.ts:66-71`):

- **Sources**: Support Ticket, Discord, GitHub Issue, Twitter, Community Forum
- **Tiers**: Enterprise, Pro, Free
- **Product Areas**: Workers, D1, Workers AI, General/Billing
- **Sentiments**: Negative, Neutral, Positive, Unknown
