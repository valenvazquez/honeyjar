import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config";
import { getDb } from "./db";
import { ensureVectorInfra } from "./services/vectorStore";
import { chatRouter } from "./routes/chat";
import { ingestRouter } from "./routes/ingest";
import { exportRouter } from "./routes/export";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/chat", chatRouter);
app.use("/api/ingest", ingestRouter);
app.use("/api/export", exportRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function start() {
  const dataDir = process.env.DB_DIR ?? "data";
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  getDb();
  console.log("[db] SQLite initialized");

  try {
    await ensureVectorInfra();
    console.log("[s3v] Vector infrastructure ready");
  } catch (err) {
    console.warn(
      "[s3v] Could not initialize vector infra — will retry on first use:",
      (err as Error).message,
    );
  }

  app.listen(config.PORT, () => {
    console.log(`[server] listening on http://localhost:${config.PORT}`);
  });
}

start();
