import { S3VectorsClient, DeleteIndexCommand } from "@aws-sdk/client-s3vectors";
import { config } from "../src/config.js";

const client = new S3VectorsClient({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

async function main() {
  try {
    await client.send(
      new DeleteIndexCommand({
        vectorBucketName: config.S3V_BUCKET_NAME,
        indexName: config.S3V_INDEX_NAME,
      })
    );
    console.log("Deleted old index:", config.S3V_INDEX_NAME);
  } catch (e: any) {
    console.log("Delete error:", e.message);
  }
}

main();
