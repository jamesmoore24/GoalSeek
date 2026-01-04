import { getOpenRouterInstance } from "@/app/lib/openai";

// Using text-embedding-3-small via OpenRouter (1536 dimensions)
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Generate embedding for a single text string
 */
export async function embedText(text: string): Promise<number[]> {
  const openRouter = getOpenRouterInstance();

  const response = await openRouter.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single request
 * More efficient than calling embedText multiple times
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const openRouter = getOpenRouterInstance();

  const response = await openRouter.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  // Sort by index to ensure correct order
  return response.data
    .sort((a, b) => a.index - b.index)
    .map(item => item.embedding);
}

/**
 * Format embedding array for Supabase pgvector insert
 * Converts number[] to string format: '[0.1, 0.2, ...]'
 */
export function formatEmbeddingForPgvector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Calculate cosine similarity between two embeddings
 * Useful for client-side filtering or debugging
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
