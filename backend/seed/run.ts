import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { S3VectorsClient, DeleteIndexCommand } from "@aws-sdk/client-s3vectors";
import { config } from "../src/config.js";
import { ensureVectorInfra } from "../src/services/vectorStore.js";
import { ingestFromNewsAPI } from "../src/services/ingestion.js";

const NEWSAPI_QUERIES = [
  "EV battery OR solid-state battery OR lithium OR electric vehicle",
  "restaurant robot OR kitchen automation OR food tech startup",
  "fintech OR mortgage tech OR AWS cloud infrastructure",
];

async function reset() {
  console.log("[seed] Resetting — dropping DB and S3 Vectors index...");

  const dbPath = path.resolve(
    process.cwd(),
    process.env.DB_DIR ?? "data",
    "honeyjar.sqlite",
  );
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log("[seed] Deleted SQLite DB:", dbPath);
  } else {
    console.log("[seed] No DB file found at", dbPath);
  }

  const s3Client = new S3VectorsClient({
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });
  try {
    await s3Client.send(
      new DeleteIndexCommand({
        vectorBucketName: config.S3V_BUCKET_NAME,
        indexName: config.S3V_INDEX_NAME,
      }),
    );
    console.log("[seed] Deleted S3 Vectors index:", config.S3V_INDEX_NAME);
  } catch (e: any) {
    console.log("[seed] Index delete (may not exist):", e.message);
  }
}

async function seed() {
  const doReset = process.argv.includes("--reset");
  if (doReset) {
    await reset();
  }

  console.log("[seed] Starting...");

  await ensureVectorInfra();
  console.log("[seed] Vector infrastructure ready");

  let totalIngested = 0;
  let totalSkipped = 0;

  for (const query of NEWSAPI_QUERIES) {
    console.log(`[seed] Fetching from NewsAPI: "${query}"...`);
    const result = await ingestFromNewsAPI(query, 100);
    totalIngested += result.ingested;
    totalSkipped += result.skipped;
    console.log(
      `[seed]   Ingested: ${result.ingested}, Skipped: ${result.skipped}`,
    );
  }

  console.log(
    `[seed] Total: ${totalIngested} ingested, ${totalSkipped} skipped`,
  );

  console.log("[seed] Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
