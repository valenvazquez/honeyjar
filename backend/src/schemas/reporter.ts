import { z } from "zod";

export const REPORTER_GEOGRAPHY = ["us_only", "us_eu_uk", "global"] as const;
export type ReporterGeography = (typeof REPORTER_GEOGRAPHY)[number];

export const ReporterSchema = z.object({
  slug: z.string(),
  name: z.string(),
  outlet: z.string(),
  title: z.string().default(""),
  email: z.string().nullable().default(null),
  emailConfidence: z.enum(["high", "medium", "low", "none"]).default("none"),
  linkedinUrl: z.string().nullable().default(null),
  twitterHandle: z.string().nullable().default(null),
  geography: z.enum(REPORTER_GEOGRAPHY).nullable().default(null),
  articleCount: z.number().default(0),
  lastArticleDate: z.string().nullable().default(null),
});

export type Reporter = z.infer<typeof ReporterSchema>;

export const MatchedArticleSchema = z.object({
  title: z.string(),
  url: z.string(),
  publishDate: z.string(),
  similarity: z.number(),
});

export type MatchedArticle = z.infer<typeof MatchedArticleSchema>;

export const ReporterMatchSchema = z.object({
  reporter: ReporterSchema,
  score: z.number(),
  explanation: z.string(),
  keyphrases: z.array(z.string()),
  matchedArticles: z.array(MatchedArticleSchema),
});

export type ReporterMatch = z.infer<typeof ReporterMatchSchema>;
