import { getDb } from "../db.js";
import { embedText } from "./embeddings.js";
import { chat } from "./llm.js";
import { queryVectors } from "./vectorStore.js";
import { groupByReporter, scoreReporters } from "./ranking.js";
import { enrichReporters } from "./enrichment.js";
import type { ReporterMatch } from "../schemas/reporter.js";

const EXPLAIN_SYSTEM_PROMPT = `You are a media-matching assistant that explains why reporters are a good fit for a story brief.

You will receive a story brief and a list of reporters, each with their name, outlet, and most relevant articles.

For each reporter, provide:
1. A concise 2-3 sentence explanation of why they are a good fit. Mention specific articles and topics.
2. 3-5 keyphrases that capture the thematic overlap.

Respond with a JSON array only. One object per reporter, in the same order as the input list.
Each object: { "explanation": "...", "keyphrases": ["...", "..."] }
No markdown fences.`;

export interface MatchOptions {
  briefText: string;
  outletTypes: string[];
  geography: string[];
  prioritizedPubs?: string | null;
  competitorContext?: string | null;
  topK?: number;
  maxReporters?: number;
}

export async function matchReporters(
  options: MatchOptions,
): Promise<ReporterMatch[]> {
  const {
    briefText,
    outletTypes,
    geography,
    prioritizedPubs = null,
    competitorContext = null,
    topK = 100,
    maxReporters = 10,
  } = options;

  // Enrich the query with competitor context if provided
  const queryText = competitorContext
    ? `${briefText}\n\nRelated context: ${competitorContext}`
    : briefText;

  const queryVector = await embedText(queryText);

  const results = await queryVectors(queryVector, topK);

  const grouped = groupByReporter(results);

  const slugs = grouped.map((g) => g.authorSlug);
  const reporterGeography = new Map<string, string | null>();
  if (slugs.length > 0) {
    const placeholders = slugs.map(() => "?").join(",");
    const rows = getDb()
      .prepare(
        `SELECT slug, geography FROM reporters WHERE slug IN (${placeholders})`,
      )
      .all(...slugs) as Array<{ slug: string; geography: string | null }>;
    for (const row of rows) {
      const geo = row.geography;
      reporterGeography.set(
        row.slug,
        geo && ["us_only", "us_eu_uk", "global"].includes(geo) ? geo : null,
      );
    }
  }

  const scored = scoreReporters(grouped, {
    preferredOutletTypes: outletTypes,
    preferredGeography: geography,
    reporterGeography,
    prioritizedPubs,
  });

  const top = scored.slice(0, maxReporters);

  const topSlugs = top.map((r) => r.authorSlug);
  const enriched = await enrichReporters(topSlugs);

  if (top.length === 0) return [];

  const reporterBlocks = top.map((sr, i) => {
    const articleContext = sr.topArticles
      .map(
        (a) =>
          `- "${a.title}" (${a.publishDate}) — ${a.metadata.summary ?? ""}`,
      )
      .join("\n");
    return `--- Reporter ${i + 1}: ${sr.authorName} at ${sr.outlet} ---
Their most relevant articles:
${articleContext}`;
  });

  const prompt = `Story brief: ${briefText}

${reporterBlocks.join("\n\n")}`;

  let explanationsList: Array<{ explanation?: string; keyphrases?: string[] }> =
    [];
  try {
    const raw = await chat(EXPLAIN_SYSTEM_PROMPT, prompt);
    const parsed = JSON.parse(
      raw
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim(),
    );
    explanationsList = Array.isArray(parsed) ? parsed : [];
  } catch {
    // Fall through with empty list; fallback used per reporter
  }

  const matches: ReporterMatch[] = [];

  for (let i = 0; i < top.length; i++) {
    const sr = top[i];
    const reporter = enriched.get(sr.authorSlug);
    if (!reporter) continue;

    const item = explanationsList[i];
    const explanation =
      item?.explanation ??
      `${sr.authorName} covers topics closely related to your brief, with ${sr.articles.length} relevant article(s) at ${sr.outlet}.`;
    const keyphrases = item?.keyphrases ?? [];

    matches.push({
      reporter,
      score: sr.score,
      explanation,
      keyphrases,
      matchedArticles: sr.topArticles.map((a) => ({
        title: a.title,
        url: a.url,
        publishDate: a.publishDate,
        similarity: a.similarity,
      })),
    });
  }

  return matches;
}
