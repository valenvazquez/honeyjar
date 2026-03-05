import type { QueryResult } from "./vectorStore.js";

const WEIGHTS = {
  topical: 0.7,
  recency: 0.15,
  outletRelevance: 0.15,
};

const OUTLET_TYPE_MAP: Record<string, string> = {
  TechCrunch: "national_business_tech",
  "The Verge": "national_business_tech",
  Bloomberg: "national_business_tech",
  Reuters: "national_business_tech",
  "The Information": "national_business_tech",
  Wired: "national_business_tech",
  "Ars Technica": "national_business_tech",
  "Canary Media": "trade_specialist",
  "E&E News": "trade_specialist",
  "IEEE Spectrum": "trade_specialist",
  "The Robot Report": "trade_specialist",
  "Nation's Restaurant News": "trade_specialist",
  "American Banker": "trade_specialist",
  Protocol: "trade_specialist",
};

export interface GroupedReporter {
  authorSlug: string;
  authorName: string;
  outlet: string;
  articles: Array<{
    key: string;
    title: string;
    url: string;
    publishDate: string;
    similarity: number;
    metadata: Record<string, any>;
  }>;
}

export function groupByReporter(results: QueryResult[]): GroupedReporter[] {
  const groups = new Map<string, GroupedReporter>();

  for (const r of results) {
    const meta = r.metadata ?? {};
    const slug = meta.authorSlug as string;
    if (!slug) continue;

    // Cosine distance → similarity: S3 Vectors returns distance, lower = more similar
    const similarity = 1 - r.distance;

    if (!groups.has(slug)) {
      groups.set(slug, {
        authorSlug: slug,
        authorName: meta.authorName as string,
        outlet: meta.outletNormalized as string,
        articles: [],
      });
    }

    groups.get(slug)!.articles.push({
      key: r.key,
      title: meta.title as string,
      url: meta.url as string,
      publishDate: meta.publishDate as string,
      similarity,
      metadata: meta,
    });
  }

  return Array.from(groups.values());
}

function recencyScore(publishDate: string): number {
  const now = Date.now();
  const published = new Date(publishDate).getTime();
  const daysSince = (now - published) / (1000 * 60 * 60 * 24);

  if (daysSince <= 90) return 1.0;
  if (daysSince <= 180) return 0.5 + 0.5 * (1 - (daysSince - 90) / 90);
  if (daysSince <= 365) return 0.25 * (1 - (daysSince - 180) / 185);
  return 0;
}

function outletRelevanceScore(
  outlet: string,
  preferredTypes: string[],
): number {
  if (preferredTypes.length === 0) return 0.5;
  const type = OUTLET_TYPE_MAP[outlet];
  if (!type) return 0.3;
  return preferredTypes.includes(type) ? 1.0 : 0.1;
}

function geographyScore(
  reporterGeo: string | null,
  preferredGeo: string[],
): number {
  if (preferredGeo.length === 0) return 1.0;
  if (!reporterGeo) return 0.5; // neutral when unknown
  return preferredGeo.includes(reporterGeo) ? 1.0 : 0.1;
}

function prioritizedPubsBoost(
  outlet: string,
  prioritized: string | null,
): number {
  if (!prioritized) return 0;
  const pubs = prioritized.split(",").map((p) => p.trim().toLowerCase());
  return pubs.some((p) => outlet.toLowerCase().includes(p)) ? 0.15 : 0;
}

export interface ScoringOptions {
  preferredOutletTypes?: string[];
  preferredGeography?: string[];
  reporterGeography?: Map<string, string | null>; // slug -> us_only | us_eu_uk | global
  prioritizedPubs?: string | null;
}

export interface ScoredReporter extends GroupedReporter {
  score: number;
  topicalScore: number;
  recencyAvg: number;
  outletScore: number;
  topArticles: GroupedReporter["articles"];
}

export function scoreReporters(
  grouped: GroupedReporter[],
  options: ScoringOptions = {},
): ScoredReporter[] {
  const {
    preferredOutletTypes = [],
    preferredGeography = [],
    reporterGeography,
    prioritizedPubs = null,
  } = options;

  const scored: ScoredReporter[] = grouped.map((g) => {
    const topicalScore =
      g.articles.reduce((sum, a) => sum + a.similarity, 0) / g.articles.length;

    const recencyAvg =
      g.articles.reduce((sum, a) => sum + recencyScore(a.publishDate), 0) /
      g.articles.length;

    const outletScore = outletRelevanceScore(g.outlet, preferredOutletTypes);
    const reporterGeo = reporterGeography?.get(g.authorSlug) ?? null;
    const geoScore = geographyScore(reporterGeo, preferredGeography);
    const pubBoost = prioritizedPubsBoost(g.outlet, prioritizedPubs);

    const score =
      WEIGHTS.topical * topicalScore +
      WEIGHTS.recency * recencyAvg +
      WEIGHTS.outletRelevance * (outletScore * 0.5 + geoScore * 0.5) +
      pubBoost;

    const topArticles = [...g.articles]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    return {
      ...g,
      score,
      topicalScore,
      recencyAvg,
      outletScore,
      topArticles,
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}
