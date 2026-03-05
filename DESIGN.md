# HoneyJar — Design Note

## Data Model

### Article

Stored as vector embeddings in AWS S3 Vectors with metadata:

| Field | Type | Description |
|-------|------|-------------|
| key | UUID | Unique article identifier (S3V vector key) |
| authorName | string | Byline name as published |
| authorSlug | string | Normalized slug for deduplication |
| title | string | Article headline |
| outlet | string | Raw publication name |
| outletNormalized | string | Canonicalized outlet name |
| publishDate | ISO 8601 | Publication timestamp |
| url | string | Canonical article URL (dedup key) |
| summary | string | 2-3 sentence article summary |

Embeddings are generated using `gemini-embedding-001` (768 dimensions) from `title + summary`. Task type `RETRIEVAL_DOCUMENT` is used for indexing.

A mirror of article metadata is stored in SQLite for fast local lookups and reporter aggregation.

### Reporter

Aggregated from articles and enriched with contact information. Stored in SQLite.

| Field | Type | Description |
|-------|------|-------------|
| slug | string (PK) | Lowercase hyphenated name |
| name | string | Display name |
| outlet | string | Primary outlet |
| title | string | Job title |
| email | string? | Guessed or known email |
| emailConfidence | enum | high / medium / low / none |
| linkedinUrl | string? | LinkedIn profile URL |
| twitterHandle | string? | Twitter/X handle |
| articleCount | int | Total articles ingested |
| lastArticleDate | ISO 8601? | Most recent article date |

### Chat Session

Persisted in SQLite to maintain conversation state across requests.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Session identifier |
| briefText | string? | Original story brief |
| outletTypes | JSON array | Selected outlet type filters |
| geography | JSON array | Selected geography filters |
| messages | JSON array | Full chat history |
| lastResults | JSON? | Most recent match results |

---

## Ranking Formula

When a user submits a story brief, the system:

1. **Embeds the brief** using `gemini-embedding-001` with task type `RETRIEVAL_QUERY`
2. **Queries S3 Vectors** for the top 100 articles by cosine similarity
3. **Groups articles by reporter** using the `authorSlug` field
4. **Scores each reporter** using a weighted combination:

```
finalScore = 0.50 * topical + 0.25 * recency + 0.25 * outletRelevance
```

### Weights

| Signal | Weight | Calculation |
|--------|--------|-------------|
| Topical similarity | 0.50 | Average cosine similarity of all matched articles by this reporter |
| Recency boost | 0.25 | Linear decay: 1.0 at today, 0.75 at 90 days, 0.5 at 180 days, 0.0 at 365 days |
| Outlet relevance | 0.25 | 1.0 if outlet type matches user preference, 0.3 if unclassified, 0.1 if mismatched |

Outlet types are mapped from a curated dictionary (`OUTLET_TYPE_MAP`) that classifies known publications into categories: `national_business_tech`, `trade_specialist`, `regional`, `newsletters`, `podcasts`.

### Explainability

For each top reporter, Gemini generates a 2-3 sentence explanation citing specific articles and thematic overlap. This ensures recommendations are transparent and defensible.

---

## Future Improvements

### Data Sources
- **Commercial APIs**: Replace NewsAPI with Meltwater, Cision, or GDELT for broader coverage and historical depth
- **Byline databases**: Integrate Muck Rack or Prowly for verified reporter profiles and beat information
- **Contact enrichment**: Replace mock provider with RocketReach, Hunter.io, or Apollo.io for verified emails

### Matching Quality
- **Beat modeling**: Build persistent reporter beat profiles from article clusters rather than individual article similarity
- **Multi-vector queries**: Embed different aspects of the brief (angle, industry, geography) separately and combine scores
- **Feedback loop**: Let users rate matches to fine-tune ranking weights per account
- **Temporal weighting**: Weight articles by outlet tier and article prominence (homepage vs. blog post)

### Scale
- **Streaming ingestion**: Replace batch ingestion with a queue-based pipeline (SQS/EventBridge) for continuous article monitoring
- **Caching**: Cache embedding results and common query patterns to reduce API costs
- **Multi-tenant**: Add user accounts and per-org article collections
