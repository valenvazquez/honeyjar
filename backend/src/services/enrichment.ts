import { getDb } from "../db.js";
import type { Reporter } from "../schemas/reporter.js";

const EMAIL_PATTERNS: Record<string, { pattern: string; domain: string; confidence: "high" | "medium" }> = {
  "TechCrunch": { pattern: "first.last", domain: "techcrunch.com", confidence: "medium" },
  "The Verge": { pattern: "first.last", domain: "theverge.com", confidence: "medium" },
  "Bloomberg": { pattern: "flast", domain: "bloomberg.net", confidence: "medium" },
  "Reuters": { pattern: "first.last", domain: "thomsonreuters.com", confidence: "medium" },
  "The Information": { pattern: "first", domain: "theinformation.com", confidence: "medium" },
  "Wired": { pattern: "first_last", domain: "wired.com", confidence: "medium" },
  "American Banker": { pattern: "first.last", domain: "arizent.com", confidence: "medium" },
  "Canary Media": { pattern: "first.last", domain: "canarymedia.com", confidence: "medium" },
  "IEEE Spectrum": { pattern: "first.last", domain: "ieee.org", confidence: "medium" },
};

function guessEmail(
  name: string,
  outlet: string
): { email: string; confidence: "high" | "medium" | "low" } | null {
  const pattern = EMAIL_PATTERNS[outlet];
  if (!pattern) return null;

  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const first = parts[0].toLowerCase();
  const last = parts[parts.length - 1].toLowerCase();

  let local: string;
  switch (pattern.pattern) {
    case "first.last":
      local = `${first}.${last}`;
      break;
    case "flast":
      local = `${first[0]}${last}`;
      break;
    case "first_last":
      local = `${first}_${last}`;
      break;
    case "first":
      local = first;
      break;
    default:
      local = `${first}.${last}`;
  }

  return {
    email: `${local}@${pattern.domain}`,
    confidence: pattern.confidence,
  };
}

export interface EnrichmentProvider {
  enrich(name: string, outlet: string): Promise<{
    linkedinUrl?: string;
    twitterHandle?: string;
  }>;
}

class MockRocketReach implements EnrichmentProvider {
  async enrich(name: string, outlet: string) {
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return {
      linkedinUrl: `https://linkedin.com/in/${slug}`,
      twitterHandle: `@${slug.replace(/-/g, "")}`,
    };
  }
}

const enrichmentProvider: EnrichmentProvider = new MockRocketReach();

export async function enrichReporter(slug: string): Promise<Reporter | null> {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM reporters WHERE slug = ?")
    .get(slug) as any;

  if (!row) return null;

  if (row.email) {
    return rowToReporter(row);
  }

  const emailResult = guessEmail(row.name, row.outlet);
  const social = await enrichmentProvider.enrich(row.name, row.outlet);

  db.prepare(`
    UPDATE reporters
    SET email = ?, email_confidence = ?, linkedin_url = ?, twitter_handle = ?, updated_at = datetime('now')
    WHERE slug = ?
  `).run(
    emailResult?.email ?? null,
    emailResult?.confidence ?? "none",
    social.linkedinUrl ?? null,
    social.twitterHandle ?? null,
    slug
  );

  return rowToReporter({
    ...row,
    email: emailResult?.email ?? null,
    email_confidence: emailResult?.confidence ?? "none",
    linkedin_url: social.linkedinUrl ?? null,
    twitter_handle: social.twitterHandle ?? null,
  });
}

export async function enrichReporters(slugs: string[]): Promise<Map<string, Reporter>> {
  const results = new Map<string, Reporter>();
  for (const slug of slugs) {
    const reporter = await enrichReporter(slug);
    if (reporter) results.set(slug, reporter);
  }
  return results;
}

function rowToReporter(row: any): Reporter {
  const geo = row.geography;
  return {
    slug: row.slug,
    name: row.name,
    outlet: row.outlet,
    title: row.title ?? "",
    email: row.email ?? null,
    emailConfidence: row.email_confidence ?? "none",
    linkedinUrl: row.linkedin_url ?? null,
    twitterHandle: row.twitter_handle ?? null,
    geography: geo && ["us_only", "us_eu_uk", "global"].includes(geo) ? geo : null,
    articleCount: row.article_count ?? 0,
    lastArticleDate: row.last_article_date ?? null,
  };
}
