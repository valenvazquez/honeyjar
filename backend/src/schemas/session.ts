import { z } from "zod";

export const OutletTypeSchema = z.enum([
  "national_business_tech",
  "trade_specialist",
  "regional",
  "newsletters",
  "podcasts",
]);

export type OutletType = z.infer<typeof OutletTypeSchema>;

export const GeographySchema = z.enum(["us_only", "us_eu_uk", "global"]);

export type Geography = z.infer<typeof GeographySchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  type: z.enum(["text", "brief", "clarification", "results", "refinement"]).default("text"),
  data: z.any().optional(),
  timestamp: z.string().default(() => new Date().toISOString()),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSessionSchema = z.object({
  id: z.string().uuid(),
  briefText: z.string().nullable().default(null),
  outletTypes: z.array(OutletTypeSchema).default([]),
  geography: z.array(GeographySchema).default([]),
  prioritizedPubs: z.string().nullable().default(null),
  competitorContext: z.string().nullable().default(null),
  messages: z.array(ChatMessageSchema).default([]),
  lastResults: z.any().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ChatSession = z.infer<typeof ChatSessionSchema>;

export const ClarifyingResponseSchema = z.object({
  outletTypes: z.array(OutletTypeSchema),
  geography: z.array(GeographySchema),
  prioritizedPubs: z.string().optional(),
  competitorContext: z.string().optional(),
});

export type ClarifyingResponse = z.infer<typeof ClarifyingResponseSchema>;
