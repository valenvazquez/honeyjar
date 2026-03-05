import { Router } from "express";
import { ingestFromNewsAPI, ingestFromRSS, ingestFromURL } from "../services/ingestion.js";

export const ingestRouter = Router();

ingestRouter.post("/newsapi", async (req, res) => {
  try {
    const { query, pageSize } = req.body;
    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }
    const result = await ingestFromNewsAPI(query, pageSize);
    res.json(result);
  } catch (err) {
    console.error("[ingest/newsapi] Error:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

ingestRouter.post("/rss", async (req, res) => {
  try {
    const { feedUrl } = req.body;
    if (!feedUrl) {
      res.status(400).json({ error: "feedUrl is required" });
      return;
    }
    const result = await ingestFromRSS(feedUrl);
    res.json(result);
  } catch (err) {
    console.error("[ingest/rss] Error:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

ingestRouter.post("/url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }
    const result = await ingestFromURL(url);
    res.json(result);
  } catch (err) {
    console.error("[ingest/url] Error:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});
