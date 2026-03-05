import {
  S3VectorsClient,
  CreateVectorBucketCommand,
  CreateIndexCommand,
  PutVectorsCommand,
  QueryVectorsCommand,
} from "@aws-sdk/client-s3vectors";
import { config } from "../config.js";
import type { ArticleMetadata } from "../schemas/article.js";

const client = new S3VectorsClient({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

const DIMENSION = 384;

export async function ensureVectorInfra(): Promise<void> {
  try {
    await client.send(
      new CreateVectorBucketCommand({
        vectorBucketName: config.S3V_BUCKET_NAME,
      }),
    );
    console.log(`[s3v] Created vector bucket: ${config.S3V_BUCKET_NAME}`);
  } catch (err: any) {
    if (
      err.name === "BucketAlreadyExists" ||
      err.name === "BucketAlreadyOwnedByYou" ||
      err.name === "ConflictException"
    ) {
      console.log(
        `[s3v] Vector bucket already exists: ${config.S3V_BUCKET_NAME}`,
      );
    } else {
      throw err;
    }
  }

  try {
    await client.send(
      new CreateIndexCommand({
        vectorBucketName: config.S3V_BUCKET_NAME,
        indexName: config.S3V_INDEX_NAME,
        dimension: DIMENSION,
        distanceMetric: "cosine",
        dataType: "float32",
      }),
    );
    console.log(`[s3v] Created index: ${config.S3V_INDEX_NAME}`);
  } catch (err: any) {
    if (
      err.name === "ConflictException" ||
      err.name === "ResourceAlreadyExistsException"
    ) {
      console.log(`[s3v] Index already exists: ${config.S3V_INDEX_NAME}`);
    } else {
      throw err;
    }
  }
}

export interface VectorRecord {
  key: string;
  vector: number[];
  metadata: ArticleMetadata;
}

export async function putVectors(records: VectorRecord[]): Promise<void> {
  // S3 Vectors supports up to 50 vectors per put call
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    await client.send(
      new PutVectorsCommand({
        vectorBucketName: config.S3V_BUCKET_NAME,
        indexName: config.S3V_INDEX_NAME,
        vectors: batch.map((r) => ({
          key: r.key,
          data: { float32: r.vector },
          metadata: r.metadata as Record<string, any>,
        })),
      }),
    );
  }
}

export interface QueryResult {
  key: string;
  distance: number;
  metadata?: Record<string, any>;
}

export async function queryVectors(
  queryVector: number[],
  topK: number = 100,
): Promise<QueryResult[]> {
  const response = await client.send(
    new QueryVectorsCommand({
      vectorBucketName: config.S3V_BUCKET_NAME,
      indexName: config.S3V_INDEX_NAME,
      queryVector: { float32: queryVector },
      topK,
      returnMetadata: true,
      returnDistance: true,
    }),
  );

  return (response.vectors ?? []).map((v) => ({
    key: v.key ?? "",
    distance: v.distance ?? 1,
    metadata: v.metadata as Record<string, any> | undefined,
  }));
}
