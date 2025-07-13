export interface DeepSeekDelta {
  content?: string;
  reasoning_content?: string;
}

export interface DeepSeekCompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
}
