export type ModelType =
  | "llama-3.1-8b"
  | "llama-3.3-70b"
  | "llama-4-scout-17b-16e-instruct"
  | "qwen-3-32b"
  | "deepseek-chat"
  | "deepseek-reasoner"
  | "auto";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
  totalTokens?: number;
  reasoningTokens?: number;
  cacheHitTokens?: number;
  cacheMissTokens?: number;
}

export interface ModelInfo {
  name: string;
  usage: TokenUsage;
}
