import { OpenAI } from "openai";
import Cerebras from "@cerebras/cerebras_cloud_sdk";

// Singleton instances
let openaiInstance: OpenAI | undefined;
let deepSeekInstance: OpenAI | undefined;
let cerebrasInstance: Cerebras | undefined;
let openRouterInstance: OpenAI | undefined;

export function getOpenAIInstance(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

export function getDeepSeekInstance(): OpenAI {
  if (!deepSeekInstance) {
    deepSeekInstance = new OpenAI({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
  }
  return deepSeekInstance;
}

export function getCerebrasInstance(): Cerebras {
  if (!cerebrasInstance) {
    cerebrasInstance = new Cerebras({
      apiKey: process.env["CEREBRAS_API_KEY"],
    });
  }
  return cerebrasInstance;
}

export function getOpenRouterInstance(): OpenAI {
  if (!openRouterInstance) {
    openRouterInstance = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "https://goalseek.app",
        "X-Title": "GoalSeek",
      },
    });
  }
  return openRouterInstance;
}

// Default model for plan generation via OpenRouter
export const PLAN_MODEL = "google/gemini-2.5-flash";
