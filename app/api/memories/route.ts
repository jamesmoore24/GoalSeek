import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { embedText, embedBatch, formatEmbeddingForPgvector } from "@/lib/embeddings";
import { ExtractedMemorySchema, generateSourceId } from "@/lib/memory-extraction";

export const dynamic = "force-dynamic";

// Mock user ID (replace with actual auth when implemented)
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

// Schema for saving pre-extracted memories
const SaveMemoriesSchema = z.object({
  memories: z.array(ExtractedMemorySchema).min(1),
  pursuit_id: z.string().uuid().optional(),
});

// Schema for RAG search
const SearchMemoriesSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(20).optional().default(10),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  pursuit_id: z.string().uuid().optional(),
});

/**
 * POST /api/memories - Save pre-extracted memories with embeddings
 *
 * Request body:
 *   - memories: Array of extracted memories from /api/memories/extract
 *   - pursuit_id?: string (optional - to associate with a pursuit)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request
    const parseResult = SaveMemoriesSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { memories, pursuit_id } = parseResult.data;

    // Generate embeddings for all memories in batch
    const contents = memories.map(m => m.content);
    const embeddings = await embedBatch(contents);

    // Generate a source ID to link all memories from this extraction
    const sourceId = generateSourceId();

    // Prepare records for insertion
    const records = memories.map((memory, index) => ({
      user_id: MOCK_USER_ID,
      content: memory.content,
      memory_type: memory.type,
      importance: memory.importance,
      tags: memory.tags,
      pursuit_id: pursuit_id || null,
      source_id: sourceId,
      embedding: formatEmbeddingForPgvector(embeddings[index]),
    }));

    // Insert all memories
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_memories")
      .insert(records)
      .select("id, content, memory_type, importance, tags, created_at");

    if (error) {
      console.error("Failed to save memories:", error);
      return NextResponse.json(
        { error: "Failed to save memories to database", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      memories: data,
      count: data.length,
      source_id: sourceId,
    });

  } catch (error: any) {
    console.error("POST /api/memories error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/memories - Fetch memories (recent or by semantic search)
 *
 * Query params:
 *   - query?: string (if provided, does semantic search)
 *   - limit?: number (default: 10 for search, 20 for recent)
 *   - threshold?: number (default: 0.7, only for search)
 *   - pursuit_id?: string (filter by pursuit)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || (query ? "10" : "20"), 10);
    const threshold = parseFloat(searchParams.get("threshold") || "0.7");
    const pursuit_id = searchParams.get("pursuit_id");

    const supabase = createClient();

    // If query provided, do semantic search
    if (query) {
      // Embed the query
      const queryEmbedding = await embedText(query);

      // Use the search_memories function we created in the migration
      const { data, error } = await supabase.rpc("search_memories", {
        query_embedding: formatEmbeddingForPgvector(queryEmbedding),
        match_user_id: MOCK_USER_ID,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) {
        console.error("Semantic search error:", error);
        return NextResponse.json(
          { error: "Failed to search memories", details: error.message },
          { status: 500 }
        );
      }

      // Optionally filter by pursuit_id (could also add this to the SQL function)
      const filtered = pursuit_id
        ? (data || []).filter((m: any) => m.pursuit_id === pursuit_id)
        : data || [];

      return NextResponse.json({
        memories: filtered,
        search_type: "semantic",
        query,
      });
    }

    // Otherwise, fetch recent memories
    let dbQuery = supabase
      .from("user_memories")
      .select("id, content, memory_type, importance, tags, pursuit_id, created_at")
      .eq("user_id", MOCK_USER_ID)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (pursuit_id) {
      dbQuery = dbQuery.eq("pursuit_id", pursuit_id);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error("Failed to fetch memories:", error);
      return NextResponse.json(
        { error: "Failed to fetch memories" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      memories: data || [],
      search_type: "recent",
    });

  } catch (error: any) {
    console.error("GET /api/memories error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/memories - Delete a memory
 *
 * Query params:
 *   - id: string (memory ID to delete)
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Memory ID is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("user_memories")
      .delete()
      .eq("id", id)
      .eq("user_id", MOCK_USER_ID);

    if (error) {
      console.error("Failed to delete memory:", error);
      return NextResponse.json(
        { error: "Failed to delete memory" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("DELETE /api/memories error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
