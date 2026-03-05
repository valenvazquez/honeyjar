import { pipeline } from "@huggingface/transformers";

const MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSION = 384;

let _extractor:
  | ((
      input: string | string[],
      options?: object,
    ) => Promise<{ data: Float32Array }>)
  | null = null;

type ExtractorFn = (
  input: string | string[],
  options?: object,
) => Promise<{ data: Float32Array }>;

async function getExtractor() {
  if (!_extractor) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipe = await (pipeline("feature-extraction", MODEL, {
      dtype: "fp32",
    }) as any);
    _extractor = pipe as ExtractorFn;
  }
  return _extractor;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const extractor = await getExtractor();
  const output = (await extractor(texts, {
    pooling: "mean",
    normalize: true,
  })) as { data: Float32Array; dims: number[] };

  const data = output.data;
  const dim = EMBEDDING_DIMENSION;
  const result: number[][] = [];
  for (let i = 0; i < data.length; i += dim) {
    result.push(Array.from(data.slice(i, i + dim)));
  }
  return result;
}

export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}
