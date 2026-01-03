import { NextResponse } from "next/server";
import { getOpenRouterInstance, PLAN_MODEL } from "@/app/lib/openai";
import { buildPursuitChatContext, formatPursuitChatMessages } from "@/lib/pursuit/chat";
import { executePursuitFunction, getPursuitFunctionDefinitions } from "@/lib/pursuit/functions";

// Mock user ID (replace with actual auth when implemented)
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

export const runtime = 'edge';

/**
 * POST /api/chat/pursuit - Pursuit-specific chat with function calling
 * Request body:
 *   - pursuit_id: string
 *   - messages: Array<{role, content}>
 *   - include_context_docs: boolean (default: true)
 */
export async function POST(request: Request) {
  try {
    const { pursuit_id, messages, include_context_docs = true } = await request.json();

    if (!pursuit_id || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "pursuit_id and messages are required" },
        { status: 400 }
      );
    }

    // Build context for this pursuit
    const context = await buildPursuitChatContext(
      MOCK_USER_ID,
      pursuit_id,
      include_context_docs
    );

    // Format messages with pursuit context
    const formattedMessages = formatPursuitChatMessages(context, messages);

    const openRouter = getOpenRouterInstance();

    // Call with function calling enabled
    const response = await openRouter.chat.completions.create({
      model: PLAN_MODEL,
      messages: formattedMessages as any,
      tools: getPursuitFunctionDefinitions(),
      tool_choice: "auto",
      temperature: 0.7,
      stream: true,
    });

    // Create streaming response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let contentBuffer = "";
        let functionCalls: any[] = [];
        let currentToolCall: any = null;

        try {
          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta;

            // Handle tool calls
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                if (toolCall.index !== undefined) {
                  // New tool call or continuing existing one
                  if (!functionCalls[toolCall.index]) {
                    functionCalls[toolCall.index] = {
                      id: toolCall.id || '',
                      type: 'function',
                      function: {
                        name: toolCall.function?.name || '',
                        arguments: toolCall.function?.arguments || '',
                      },
                    };
                  } else {
                    // Append to existing tool call
                    if (toolCall.function?.name) {
                      functionCalls[toolCall.index].function.name += toolCall.function.name;
                    }
                    if (toolCall.function?.arguments) {
                      functionCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                    }
                  }
                }
              }
            }

            // Handle content
            const text = delta?.content || "";
            if (text) {
              contentBuffer += text;
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "content",
                    content: text,
                  }) + "\n"
                )
              );
            }

            // Check if we're done
            if (chunk.choices[0]?.finish_reason === "tool_calls") {
              // Execute function calls
              for (const call of functionCalls) {
                if (call && call.function && call.function.name && call.function.arguments) {
                  try {
                    const args = JSON.parse(call.function.arguments);
                    const result = await executePursuitFunction(
                      MOCK_USER_ID,
                      call.function.name,
                      args
                    );

                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          type: "function_result",
                          function: call.function.name,
                          arguments: args,
                          result,
                        }) + "\n"
                      )
                    );
                  } catch (error) {
                    console.error("Error executing function:", error);
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          type: "function_error",
                          function: call.function.name,
                          error: error instanceof Error ? error.message : "Function execution failed",
                        }) + "\n"
                      )
                    );
                  }
                }
              }
            }
          }

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "Stream failed",
              }) + "\n"
            )
          );
          controller.close();
        }
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Pursuit chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
