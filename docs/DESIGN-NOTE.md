# Honeyjar Design Note

**Media reporter matching for PR/comms professionals**

---

## 1. Data Model

### Core Entities

| Entity | Storage | Purpose |
|--------|---------|---------|
| **Article** | SQLite + S3 Vectors | News articles with author attribution; embedded for semantic search |
| **Reporter** | SQLite | Aggregated profile per author (slug, outlet, geography, contact info, article count) |
| **Session** | SQLite | Chat context: brief, preferences, messages, last match results |

### Article Schema

```
articles: id (UUID), author_name, author_slug, title, outlet, outlet_normalized,
           publish_date, url (unique), summary, created_at
```

Embedding text: `{title}. {summary}` → 384-dim float32 vector (cosine distance).

### Reporter Schema

```
reporters: slug (PK), name, outlet, title, email, email_confidence,
           linkedin_url, twitter_handle, geography, article_count, last_article_date,
           created_at, updated_at
```

Reporter = deduplicated author; `author_slug` = `slugify(name)`; one reporter per `(name, outlet)`.

**Geography** (`us_only` | `us_eu_uk` | `global`): Set during ingestion from News API Sources (outlet country) or static outlet fallback. Enrichment providers (e.g. RocketReach) can override when they return reporter location.

### Vector Store (S3 Vectors)

- **Key**: article `id`
- **Metadata**: authorName, authorSlug, title, outlet, outletNormalized, publishDate, url, summary
- **Index**: cosine distance, float32

---

## 2. Ranking Formula

### Weights (configurable)

| Factor | Weight | Description |
|--------|--------|-------------|
| **Topical** | 0.70 | Semantic similarity of articles to brief (1 − cosine distance) |
| **Recency** | 0.15 | How recent the reporter’s articles are |
| **Outlet relevance** | 0.15 | Outlet type + reporter geography fit |

### Score Formula

```
score = w_topical × topicalScore
      + w_recency × recencyAvg
      + w_outlet × (outletScore × 0.5 + geoScore × 0.5)
      + pubBoost
```

- **topicalScore**: mean similarity of reporter’s matched articles
- **recencyAvg**: mean of `recencyScore(publishDate)` per article
- **outletScore**: 1.0 if outlet type in preferred types, else 0.1 (1.0 if no preference)
- **geoScore**: 1.0 if reporter geography matches preferred; 0.5 if unknown; 0.1 if mismatch
- **pubBoost**: +0.15 if outlet in `prioritizedPubs` list

Geography is read from `reporters.geography` (DB), not inferred from outlet.

### Recency Curve

| Days since publish | Score |
|--------------------|-------|
| ≤ 90 | 1.0 |
| 91–180 | 0.5 → 1.0 (linear decay) |
| 181–365 | 0 → 0.25 |
| > 365 | 0 |

### Outlet Classification

- **Types**: `national_business_tech`, `trade_specialist`
- **Geography** (reporter-level): `us_only`, `us_eu_uk`, `global`

### Geography Ingestion

- **News API Sources**: Fetch `/v2/sources`, map `source.id` → `country` → geography (us→us_only, gb/de/fr/etc→us_eu_uk, else→global)
- **Static fallback**: `OUTLET_GEO_FALLBACK` for known outlets when Sources API has no match
- **COALESCE**: Reporter geography set on first insert; enrichment can override later

---

## 3. Next Steps: Commercial Data & Enterprise

### 3.1 Commercial Data Sources

**LexisNexis**

- Use for: legal/regulatory, court filings, corporate news, broader coverage
- Integration: API connector → normalize to `Article` schema; add `source: "lexisnexis"`
- Considerations: licensing, rate limits, legal use restrictions; store only permitted fields

**RocketReach**

- Use for: verified email, LinkedIn, Twitter, job title, **reporter geography** (overrides ingestion)
- Integration: replace `MockRocketReach` with real API; cache in `reporters` table
- Considerations: per-lookup cost; batch enrichment; respect opt-out / privacy

**Data model extensions**

- `article_sources` table: source_id, source_type (newsapi|rss|lexisnexis|manual)
- `reporter_enrichments`: provider, fetched_at, fields (email, linkedin, geography, etc.)

### 3.2 Multi-Tenancy

- Add `tenant_id` (UUID) to: `articles`, `reporters`, `sessions`
- Vector store: namespace by tenant (e.g. key = `{tenant_id}/{article_id}` or separate index per tenant)
- API: resolve tenant from JWT, API key, or subdomain; enforce tenant isolation in all queries

### 3.3 RBAC (Role-Based Access Control)

| Role | Permissions |
|------|-------------|
| **Admin** | Full access, manage users, ingest, export |
| **Editor** | Ingest, match, export; no user management |
| **Viewer** | Match, view results; no ingest/export |

- Store roles in `users` table: `user_id`, `tenant_id`, `role`
- Middleware: check role before route handler
- Optional: resource-level permissions (e.g. per-brief or per-campaign)

### 3.4 Auditability

- **Audit log table**: `audit_log (id, tenant_id, user_id, action, resource_type, resource_id, payload, ip, created_at)`
- Log: ingest, match, export, user/login, config changes
- Retention policy (e.g. 90 days); support compliance exports
- Optional: immutable append-only log (e.g. S3 + checksums)

---

## Summary

| Area | Current | Next |
|------|---------|------|
| Data | Articles + Reporters (incl. geography), SQLite + S3 Vectors | Add source tracking, enrichment cache |
| Ranking | Topical 70%, Recency 15%, Outlet 15% (type + reporter geo) | Add optional engagement/volume signals |
| Geography | News API Sources + outlet fallback → reporter.geography | RocketReach override for reporter location |
| Enrichment | Heuristic email + mock social | RocketReach API; LexisNexis for content |
| Tenancy | Single | tenant_id + vector isolation |
| Auth | None | RBAC (Admin/Editor/Viewer) |
| Audit | None | audit_log table + retention |
