import { Router } from "express";
import { getDb } from "../db.js";
import type { ReporterMatch } from "../schemas/reporter.js";

export const exportRouter = Router();

exportRouter.get("/:sessionId/csv", (req, res) => {
  const row = getDb()
    .prepare("SELECT last_results FROM sessions WHERE id = ?")
    .get(req.params.sessionId) as any;

  if (!row || !row.last_results) {
    res.status(404).json({ error: "No results found for this session" });
    return;
  }

  const matches: ReporterMatch[] = JSON.parse(row.last_results);

  const headers = [
    "Name",
    "Outlet",
    "Title",
    "Email",
    "Email Confidence",
    "LinkedIn",
    "Twitter",
    "Score",
    "Explanation",
    "Article 1",
    "Article 2",
    "Article 3",
  ];

  const rows = matches.map((m) => {
    const articles = m.matchedArticles.slice(0, 3);
    return [
      csvEscape(m.reporter.name),
      csvEscape(m.reporter.outlet),
      csvEscape(m.reporter.title),
      csvEscape(m.reporter.email ?? ""),
      csvEscape(m.reporter.emailConfidence),
      csvEscape(m.reporter.linkedinUrl ?? ""),
      csvEscape(m.reporter.twitterHandle ?? ""),
      m.score.toFixed(3),
      csvEscape(m.explanation),
      ...articles.map((a) => csvEscape(`${a.title} (${a.url})`)),
      ...Array(3 - articles.length).fill(""),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=media-list-${req.params.sessionId}.csv`);
  res.send(csv);
});

exportRouter.get("/:sessionId/emails", (req, res) => {
  const row = getDb()
    .prepare("SELECT last_results FROM sessions WHERE id = ?")
    .get(req.params.sessionId) as any;

  if (!row || !row.last_results) {
    res.status(404).json({ error: "No results found for this session" });
    return;
  }

  const matches: ReporterMatch[] = JSON.parse(row.last_results);

  const emails = matches
    .filter((m) => m.reporter.email)
    .map((m) => m.reporter.email!)
    .join(", ");

  res.json({ emails, count: emails.split(", ").filter(Boolean).length });
});

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
