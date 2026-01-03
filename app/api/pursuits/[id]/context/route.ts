import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { UploadContextSchema } from "@/lib/schemas/pursuit";
import type { PursuitContext } from "@/types/pursuit";

// Mock user ID (replace with actual auth when implemented)
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * GET /api/pursuits/[id]/context - List context documents for a pursuit
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pursuit_context")
      .select("*")
      .eq("pursuit_id", params.id)
      .eq("user_id", MOCK_USER_ID)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching contexts:", error);
      throw error;
    }

    return NextResponse.json({ contexts: data as PursuitContext[] });
  } catch (error) {
    console.error("GET /api/pursuits/[id]/context error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pursuits/[id]/context - Upload context document
 * Supports: base64 files or URLs
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parseResult = UploadContextSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parseResult.error.flatten()
        },
        { status: 400 }
      );
    }

    const { filename, file_type, content_base64, url } = parseResult.data;
    const supabase = createClient();

    // Verify pursuit exists and belongs to user
    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuits")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", MOCK_USER_ID)
      .single();

    if (pursuitError && pursuitError.code === "PGRST116") {
      return NextResponse.json(
        { error: "Pursuit not found" },
        { status: 404 }
      );
    }

    if (pursuitError) {
      console.error("Error verifying pursuit:", pursuitError);
      throw pursuitError;
    }

    let storagePath = '';
    let contentText = '';
    let fileSizeBytes: number | null = null;

    // Handle base64 content upload
    if (content_base64) {
      const buffer = Buffer.from(content_base64, 'base64');
      fileSizeBytes = buffer.length;

      // Generate unique path
      const timestamp = Date.now();
      const path = `${MOCK_USER_ID}/${params.id}/${timestamp}-${filename}`;

      // TODO: In production, upload to Supabase Storage
      // For now, we'll store a placeholder path
      storagePath = path;

      // TODO: Extract text based on file type
      // For PDF: use pdf-parse library
      // For images: use tesseract.js or cloud OCR
      // For now, placeholder
      if (file_type === 'text') {
        contentText = buffer.toString('utf-8');
      } else {
        contentText = `[${file_type} content extraction not yet implemented]`;
      }
    } else if (url) {
      storagePath = url;
      contentText = `[URL: ${url}]`;
    }

    // Store metadata in database
    const { data, error } = await supabase
      .from("pursuit_context")
      .insert({
        pursuit_id: params.id,
        user_id: MOCK_USER_ID,
        filename,
        file_type,
        storage_path: storagePath,
        content_text: contentText || null,
        file_size_bytes: fileSizeBytes,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating context:", error);
      throw error;
    }

    return NextResponse.json({ context: data as PursuitContext }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pursuits/[id]/context error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pursuits/[id]/context/[contextId] - Delete context document
 * Note: This is a simple implementation, you may want a separate route
 */
