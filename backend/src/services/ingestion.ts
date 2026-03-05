import { v4 as uuid } from "uuid";
import { config } from "../config";
import { getDb } from "../db";
import { embedTexts } from "./embeddings.js";
import { putVectors, type VectorRecord } from "./vectorStore";
import type { Article } from "../schemas/article";
import type { ReporterGeography } from "../schemas/reporter.js";
import NewsAPI from "newsapi";

const US_ONLY_COUNTRIES = new Set(["us"]);
const US_EU_UK_COUNTRIES = new Set([
  "gb", "de", "fr", "ie", "nl", "be", "at", "ch", "pl", "es", "it", "se",
  "no", "fi", "dk", "pt", "gr", "cz", "ro", "hu", "bg", "sk", "lt", "lv", "ee",
]);

function countryToGeography(country: string | null | undefined): ReporterGeography | null {
  if (!country) return null;
  const c = country.toLowerCase();
  if (US_ONLY_COUNTRIES.has(c)) return "us_only";
  if (US_EU_UK_COUNTRIES.has(c)) return "us_eu_uk";
  return "global";
}

let sourcesCache: Map<string, ReporterGeography | null> | null = null;

async function getSourceGeographyMap(newsapi: NewsAPI): Promise<Map<string, ReporterGeography | null>> {
  if (sourcesCache) return sourcesCache;
  try {
    const res = await newsapi.v2.sources({});
    const map = new Map<string, ReporterGeography | null>();
    for (const s of res.sources ?? []) {
      const geo = countryToGeography((s as { country?: string }).country);
      map.set((s as { id: string }).id, geo);
    }
    sourcesCache = map;
    return map;
  } catch {
    return new Map();
  }
}

/** Static fallback when Sources API has no match */
const OUTLET_GEO_FALLBACK: Record<string, ReporterGeography> = {
  TechCrunch: "global",
  "The Verge": "global",
  Bloomberg: "global",
  Reuters: "global",
  "The Information": "us_eu_uk",
  Wired: "global",
  "Ars Technica": "us_only",
  "Canary Media": "us_only",
  "E&E News": "us_only",
  "IEEE Spectrum": "global",
  "The Robot Report": "global",
  "Nation's Restaurant News": "us_only",
  "American Banker": "us_only",
  Protocol: "us_only",
};

const OUTLET_NORMALIZE: Record<string, string> = {
  techcrunch: "TechCrunch",
  "the verge": "The Verge",
  reuters: "Reuters",
  bloomberg: "Bloomberg",
  "the information": "The Information",
  "american banker": "American Banker",
  "canary media": "Canary Media",
  "e&e news": "E&E News",
  "ieee spectrum": "IEEE Spectrum",
  "the robot report": "The Robot Report",
  "nation's restaurant news": "Nation's Restaurant News",
  protocol: "Protocol",
  wired: "Wired",
  "ars technica": "Ars Technica",
};

export function normalizeOutlet(raw: string): string {
  const key = raw.toLowerCase().trim();
  return OUTLET_NORMALIZE[key] ?? raw.trim();
}

export function slugifyAuthor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function buildEmbeddingText(article: {
  title: string;
  summary: string;
}): string {
  return `${article.title}. ${article.summary}`;
}

export async function ingestArticles(
  rawArticles: Array<{
    authorName: string;
    title: string;
    outlet: string;
    publishDate: string;
    url: string;
    summary: string;
    geography?: ReporterGeography | null;
  }>,
): Promise<{ ingested: number; skipped: number }> {
  const db = getDb();
  let ingested = 0;
  let skipped = 0;

  // Dedup by URL
  const existingUrls = new Set(
    db
      .prepare("SELECT url FROM articles")
      .all()
      .map((r: any) => r.url),
  );

  const newArticles: (Article & { geography?: ReporterGeography | null })[] = [];

  for (const raw of rawArticles) {
    if (existingUrls.has(raw.url)) {
      skipped++;
      continue;
    }

    const article: Article & { geography?: ReporterGeography | null } = {
      id: uuid(),
      authorName: raw.authorName,
      authorSlug: slugifyAuthor(raw.authorName),
      title: raw.title,
      outlet: raw.outlet,
      outletNormalized: normalizeOutlet(raw.outlet),
      publishDate: raw.publishDate,
      url: raw.url,
      summary: raw.summary,
      geography: raw.geography ?? undefined,
    };

    newArticles.push(article);
  }

  if (newArticles.length === 0) {
    return { ingested: 0, skipped };
  }

  // Embed all articles
  const texts = newArticles.map((a) => buildEmbeddingText(a));
  const embeddings = await embedTexts(texts);

  // Store in S3 Vectors
  const vectorRecords: VectorRecord[] = newArticles.map((a, i) => ({
    key: a.id,
    vector: embeddings[i],
    metadata: {
      authorName: a.authorName,
      authorSlug: a.authorSlug,
      title: a.title,
      outlet: a.outlet,
      outletNormalized: a.outletNormalized,
      publishDate: a.publishDate,
      url: a.url,
      summary: a.summary,
    },
  }));

  await putVectors(vectorRecords);

  // Store in SQLite
  const insertArticle = db.prepare(`
    INSERT OR IGNORE INTO articles (id, author_name, author_slug, title, outlet, outlet_normalized, publish_date, url, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertReporter = db.prepare(`
    INSERT INTO reporters (slug, name, outlet, geography, article_count, last_article_date)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(slug) DO UPDATE SET
      article_count = article_count + 1,
      last_article_date = CASE
        WHEN excluded.last_article_date > reporters.last_article_date THEN excluded.last_article_date
        ELSE reporters.last_article_date
      END,
      geography = COALESCE(reporters.geography, excluded.geography),
      updated_at = datetime('now')
  `);

  const insertMany = db.transaction(() => {
    for (const a of newArticles) {
      insertArticle.run(
        a.id,
        a.authorName,
        a.authorSlug,
        a.title,
        a.outlet,
        a.outletNormalized,
        a.publishDate,
        a.url,
        a.summary,
      );
      upsertReporter.run(
        a.authorSlug,
        a.authorName,
        a.outletNormalized,
        a.geography ?? null,
        a.publishDate,
      );
    }
  });

  insertMany();
  ingested = newArticles.length;

  return { ingested, skipped };
}

export async function ingestFromNewsAPI(
  query: string,
  pageSize: number = 50,
): Promise<{ ingested: number; skipped: number }> {
  if (!config.NEWSAPI_KEY) {
    throw new Error("NEWSAPI_KEY is not configured");
  }

  const newsapi = new NewsAPI(config.NEWSAPI_KEY);

  const [sourcesMap, response] = await Promise.all([
    getSourceGeographyMap(newsapi),
    newsapi.v2.everything({
      q: query,
      language: "en",
      sortBy: "publishedAt",
      pageSize,
    }),
  ]);

  const rawArticles = (response.articles ?? [])
    .filter((a: any) => a.author && a.title && a.url)
    .map((a: any) => {
      const outlet = a.source?.name ?? "Unknown";
      const outletNormalized = normalizeOutlet(outlet);
      const sourceId = a.source?.id;
      let geography: ReporterGeography | null =
        (sourceId && sourcesMap.get(sourceId)) ?? null;
      if (!geography) {
        geography = OUTLET_GEO_FALLBACK[outletNormalized] ?? null;
      }
      return {
        authorName: a.author,
        title: a.title,
        outlet,
        publishDate: a.publishedAt ?? new Date().toISOString(),
        url: a.url,
        summary: a.description ?? a.content ?? "",
        geography: geography ?? undefined,
      };
    });

  return ingestArticles(rawArticles);
}

export async function ingestFromRSS(
  feedUrl: string,
): Promise<{ ingested: number; skipped: number }> {
  const Parser = (await import("rss-parser")).default;
  const parser = new Parser();
  const feed = await parser.parseURL(feedUrl);

  const rawArticles = (feed.items ?? [])
    .filter((item) => item.creator || item.author)
    .map((item) => ({
      authorName: (item.creator || item.author || "Unknown").toString(),
      title: item.title ?? "Untitled",
      outlet: feed.title ?? "Unknown",
      publishDate: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
      url: item.link ?? "",
      summary: item.contentSnippet ?? item.content ?? "",
    }))
    .filter((a) => a.url);

  return ingestArticles(rawArticles);
}

export async function ingestFromURL(
  articleUrl: string,
): Promise<{ ingested: number; skipped: number }> {
  const { extract } = await import("@extractus/article-extractor");
  const article = await extract(articleUrl);

  if (!article) {
    throw new Error(`Could not extract article from ${articleUrl}`);
  }

  return ingestArticles([
    {
      authorName: article.author ?? "Unknown",
      title: article.title ?? "Untitled",
      outlet: article.source ?? new URL(articleUrl).hostname,
      publishDate: article.published ?? new Date().toISOString(),
      url: articleUrl,
      summary: article.description ?? "",
    },
  ]);
}
