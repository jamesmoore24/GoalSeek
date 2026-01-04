import { getOpenRouterInstance, PLAN_MODEL } from "@/app/lib/openai";
import { z } from "zod";

// Schema for extracted memories
export const ExtractedMemorySchema = z.object({
  content: z.string().min(10).max(500),
  type: z.enum(['insight', 'decision', 'fact', 'commitment', 'preference', 'goal', 'other']),
  tags: z.array(z.string()).max(5),
  importance: z.number().int().min(1).max(10),
});

export const ExtractionResultSchema = z.object({
  memories: z.array(ExtractedMemorySchema),
});

export type ExtractedMemory = z.infer<typeof ExtractedMemorySchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const EXTRACTION_SYSTEM_PROMPT = `You are a strict memory extraction assistant. Your job is to analyze conversations and extract ONLY genuinely valuable personal information that would be useful to remember in future conversations.

## What TO extract (be very selective):
- **Personal facts**: User's name, job, location, relationships, life circumstances
- **Specific decisions**: Concrete choices the user made (e.g., "I decided to quit my job")
- **Commitments**: Specific things the user committed to doing with dates/details
- **Goals with specifics**: Concrete goals with measurable targets (e.g., "I want to lose 20 pounds by June")
- **Preferences with context**: Strong preferences that affect future interactions
- **Key insights**: Genuine realizations or learnings the user had about themselves

## What NOT to extract (reject these completely):
- Generic statements about what the AI can do
- Obvious facts that don't need remembering
- Vague or non-specific information
- Information about the AI assistant itself
- Greetings, small talk, or filler content
- Things any user would know (e.g., "I can ask the AI for help")
- Restatements of the conversation without new information

## Quality bar:
Ask yourself: "Would this memory actually help personalize future conversations?"
If the answer is no, DO NOT include it.

## Output rules:
- Only extract memories that meet the quality bar above
- If the conversation has NO valuable memories, return an empty array: {"memories": []}
- Better to return 0-2 high-quality memories than 5 low-quality ones
- Write in first person from the user's perspective
- Be specific - include names, dates, numbers when mentioned
- Importance should be 7+ for most memories (if it's below 7, question if it should be included)

Output ONLY valid JSON:
{
  "memories": [
    {
      "content": "Specific, personal memory text in first person",
      "type": "insight|decision|fact|commitment|preference|goal",
      "tags": ["tag1", "tag2"],
      "importance": 7-10
    }
  ]
}`;

/**
 * Extract multiple memories from a conversation using LLM
 */
export async function extractMemories(
  messages: Message[],
  pursuitContext?: string
): Promise<ExtractionResult> {
  const openRouter = getOpenRouterInstance();

  // Format conversation for the LLM
  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const userPrompt = pursuitContext
    ? `Context: This conversation is about the pursuit "${pursuitContext}"\n\nConversation:\n${conversationText}`
    : `Conversation:\n${conversationText}`;

  const response = await openRouter.chat.completions.create({
    model: PLAN_MODEL,
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from extraction LLM");
  }

  // Parse and validate JSON response
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON from LLM: ${content}`);
  }

  const result = ExtractionResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid extraction format: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Generate a unique source ID for a batch of memories
 * This links all memories extracted from the same conversation
 */
export function generateSourceId(): string {
  return crypto.randomUUID();
}
