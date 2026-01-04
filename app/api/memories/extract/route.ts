import { NextResponse } from "next/server";
import { z } from "zod";
import { extractMemories, ExtractedMemory } from "@/lib/memory-extraction";

export const dynamic = "force-dynamic";

// Request schema
const ExtractRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).min(1),
  pursuit_name: z.string().optional(),
});

/**
 * POST /api/memories/extract
 *
 * Extract memories from a conversation WITHOUT saving them.
 * Used for the preview modal so users can review before saving.
 *
 * Request body:
 * - messages: Array of {role, content}
 * - pursuit_name: Optional pursuit context
 *
 * Response:
 * - memories: Array of extracted memories
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request
    const parseResult = ExtractRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { messages, pursuit_name } = parseResult.data;

    // Extract memories using LLM
    const result = await extractMemories(messages, pursuit_name);

    return NextResponse.json({
      memories: result.memories,
      count: result.memories.length,
    });

  } catch (error: any) {
    console.error("POST /api/memories/extract error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract memories" },
      { status: 500 }
    );
  }
}
