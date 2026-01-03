import { NextResponse } from "next/server";
import { getOpenRouterInstance, PLAN_MODEL } from "@/app/lib/openai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Add system message for LaTeX formatting
    const systemMessage = {
      role: "system" as const,
      content:
        "When writing mathematical expressions or equations, always use LaTeX/Markdown formatting with the following conventions:\n- For inline math, use single dollar signs: $x^2 + y^2 = z^2$\n- For block/display math, use double dollar signs:\n$$\n\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\n$$\nThis ensures proper rendering and consistent formatting across all mathematical content.",
    };

    // Format messages for Gemini (supports multimodal)
    const formattedMessages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      systemMessage,
      ...messages.map((msg: { role: string; content: string | object }) => ({
        role: msg.role as "user" | "assistant",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      })),
    ];

    const openRouter = getOpenRouterInstance();

    const response = await openRouter.chat.completions.create({
      model: PLAN_MODEL, // google/gemini-2.5-flash
      messages: formattedMessages,
      temperature: 0.7,
      stream: true,
    });

    // Estimate input tokens
    const totalInputContent = messages.reduce(
      (acc: string, msg: { content: string | object }) =>
        acc +
        (typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content)),
      ""
    );
    const estimatedInputTokens = Math.ceil(totalInputContent.length / 4);

    // Create stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let outputTokens = 0;

        const modelInfo = {
          name: "Gemini 2.5 Flash",
          usage: {
            inputTokens: estimatedInputTokens,
            outputTokens: 0,
            cached: false,
          },
        };

        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content || "";

          if (text) {
            outputTokens += Math.ceil(text.length / 4);

            modelInfo.usage = {
              ...modelInfo.usage,
              outputTokens,
            };

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  content: text,
                  reasoning: null,
                  modelInfo,
                  model: modelInfo.name,
                }) + "\n"
              )
            );
          }
        }
        controller.close();
      },
    });

    return new NextResponse(readableStream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
