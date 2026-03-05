import { Router } from "express";
import { v4 as uuid } from "uuid";
import { getDb } from "../db.js";
import { chat } from "../services/llm.js";
import { matchReporters } from "../services/matching.js";
import type { ChatMessage, ClarifyingResponse } from "../schemas/session.js";

export const chatRouter = Router();

const SYSTEM_PROMPT = `You are a media-matching assistant for PR/comms professionals. Your job is to help users find the best reporters for their story.

When the user provides a story brief, analyze it and respond with a JSON object containing:
{
  "analysis": "A 1-2 sentence summary of the story angle and key topics",
  "suggestedOutletTypes": ["national_business_tech", "trade_specialist", etc.],
  "suggestedGeography": ["us_only"],
  "followUpQuestion": "An optional clarifying question if the brief is vague"
}

Valid outlet types: national_business_tech, trade_specialist, regional, newsletters, podcasts
Valid geography: us_only, us_eu_uk, global

When the user provides a refinement command (e.g., "only trades", "favor climate tech", "remove podcasts"), respond with:
{
  "refinement": {
    "action": "filter" | "boost" | "remove",
    "target": "description of what to change",
    "updatedOutletTypes": [...],
    "updatedGeography": [...]
  }
}

Always respond with valid JSON only. No markdown fences.`;

// Create new session
chatRouter.post("/sessions", (_req, res) => {
  const id = uuid();
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO sessions (id, messages, created_at, updated_at) VALUES (?, '[]', ?, ?)`
    )
    .run(id, now, now);

  res.json({ sessionId: id });
});

// Get session
chatRouter.get("/sessions/:id", (req, res) => {
  const row = getDb()
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(req.params.id) as any;

  if (!row) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(sessionRowToJson(row));
});

// Send message
chatRouter.post("/sessions/:id/messages", async (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id) as any;

    if (!row) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const { content, type = "text" } = req.body;
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const messages: ChatMessage[] = JSON.parse(row.messages ?? "[]");
    const userMessage: ChatMessage = {
      role: "user",
      content,
      type,
      timestamp: new Date().toISOString(),
    };
    messages.push(userMessage);

    if (type === "brief") {
      // Initial brief submission — analyze and suggest clarifying questions
      const response = await chat(SYSTEM_PROMPT, content);
      let parsed: any;
      try {
        parsed = JSON.parse(response.trim());
      } catch {
        parsed = { analysis: response, suggestedOutletTypes: [], suggestedGeography: ["us_only"] };
      }

      db.prepare("UPDATE sessions SET brief_text = ?, updated_at = datetime('now') WHERE id = ?")
        .run(content, req.params.id);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: parsed.analysis ?? "I've analyzed your brief.",
        type: "clarification",
        data: {
          suggestedOutletTypes: parsed.suggestedOutletTypes ?? [],
          suggestedGeography: parsed.suggestedGeography ?? ["us_only"],
          followUpQuestion: parsed.followUpQuestion ?? null,
        },
        timestamp: new Date().toISOString(),
      };
      messages.push(assistantMessage);

      db.prepare("UPDATE sessions SET messages = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(messages), req.params.id);

      res.json({ message: assistantMessage });
    } else if (type === "clarification") {
      // User responded to clarifying questions — run matching
      const clarification: ClarifyingResponse = JSON.parse(content);

      db.prepare(`
        UPDATE sessions
        SET outlet_types = ?, geography = ?, prioritized_pubs = ?, competitor_context = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        JSON.stringify(clarification.outletTypes),
        JSON.stringify(clarification.geography),
        clarification.prioritizedPubs ?? null,
        clarification.competitorContext ?? null,
        req.params.id
      );

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: "Searching for the best reporters for your story...",
        type: "text",
        timestamp: new Date().toISOString(),
      };
      messages.push(assistantMessage);

      db.prepare("UPDATE sessions SET messages = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(messages), req.params.id);

      // Run matching pipeline
      const briefText = row.brief_text ?? "";
      const matches = await matchReporters({
        briefText,
        outletTypes: clarification.outletTypes,
        geography: clarification.geography,
        prioritizedPubs: clarification.prioritizedPubs ?? null,
        competitorContext: clarification.competitorContext ?? null,
      });

      const resultsMessage: ChatMessage = {
        role: "assistant",
        content: `Found ${matches.length} matching reporters for your story.`,
        type: "results",
        data: { matches },
        timestamp: new Date().toISOString(),
      };
      messages.push(resultsMessage);

      db.prepare("UPDATE sessions SET messages = ?, last_results = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(messages), JSON.stringify(matches), req.params.id);

      res.json({ message: resultsMessage });
    } else if (type === "refinement") {
      // User wants to refine results
      const history = messages
        .filter((m) => m.type !== "results")
        .slice(-6)
        .map((m) => ({ role: m.role === "user" ? "user" as const : "model" as const, content: m.content }));

      const response = await chat(SYSTEM_PROMPT, content, history);
      let parsed: any;
      try {
        parsed = JSON.parse(response.trim());
      } catch {
        parsed = { refinement: null };
      }

      // Re-run matching with updated preferences
      const updatedOutletTypes = parsed.refinement?.updatedOutletTypes
        ?? JSON.parse(row.outlet_types ?? "[]");
      const updatedGeography = parsed.refinement?.updatedGeography
        ?? JSON.parse(row.geography ?? "[]");

      db.prepare(`
        UPDATE sessions SET outlet_types = ?, geography = ?, updated_at = datetime('now') WHERE id = ?
      `).run(JSON.stringify(updatedOutletTypes), JSON.stringify(updatedGeography), req.params.id);

      const matches = await matchReporters({
        briefText: row.brief_text ?? "",
        outletTypes: updatedOutletTypes,
        geography: updatedGeography,
        prioritizedPubs: row.prioritized_pubs ?? null,
        competitorContext: row.competitor_context ?? null,
      });

      const resultsMessage: ChatMessage = {
        role: "assistant",
        content: parsed.refinement
          ? `Updated results based on your refinement: ${parsed.refinement.target}`
          : `Here are your updated results.`,
        type: "results",
        data: { matches },
        timestamp: new Date().toISOString(),
      };
      messages.push(resultsMessage);

      db.prepare("UPDATE sessions SET messages = ?, last_results = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(messages), JSON.stringify(matches), req.params.id);

      res.json({ message: resultsMessage });
    } else {
      // Generic text message — pass to LLM for conversational response
      const history = messages.slice(-6).map((m) => ({
        role: m.role === "user" ? "user" as const : "model" as const,
        content: m.content,
      }));

      const response = await chat(SYSTEM_PROMPT, content, history);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response,
        type: "text",
        timestamp: new Date().toISOString(),
      };
      messages.push(assistantMessage);

      db.prepare("UPDATE sessions SET messages = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(messages), req.params.id);

      res.json({ message: assistantMessage });
    }
  } catch (err) {
    console.error("[chat] Error:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

function sessionRowToJson(row: any) {
  return {
    id: row.id,
    briefText: row.brief_text,
    outletTypes: JSON.parse(row.outlet_types ?? "[]"),
    geography: JSON.parse(row.geography ?? "[]"),
    prioritizedPubs: row.prioritized_pubs,
    competitorContext: row.competitor_context,
    messages: JSON.parse(row.messages ?? "[]"),
    lastResults: row.last_results ? JSON.parse(row.last_results) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
