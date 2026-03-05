import { z } from "zod";

export const ArticleSchema = z.object({
  id: z.string().uuid(),
  authorName: z.string(),
  authorSlug: z.string(),
  title: z.string(),
  outlet: z.string(),
  outletNormalized: z.string(),
  publishDate: z.string(),
  url: z.string().url(),
  summary: z.string(),
});

export type Article = z.infer<typeof ArticleSchema>;

export const ArticleMetadataSchema = z.object({
  authorName: z.string(),
  authorSlug: z.string(),
  title: z.string(),
  outlet: z.string(),
  outletNormalized: z.string(),
  publishDate: z.string(),
  url: z.string(),
  summary: z.string(),
});

export type ArticleMetadata = z.infer<typeof ArticleMetadataSchema>;
