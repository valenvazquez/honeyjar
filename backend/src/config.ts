import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const envSchema = z.object({
  GOOGLE_API_KEY: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().default("us-east-1"),
  S3V_BUCKET_NAME: z.string().default("honeyjar-vectors"),
  S3V_INDEX_NAME: z.string().default("articles"),
  NEWSAPI_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  PORT: z.coerce.number().default(3001),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
