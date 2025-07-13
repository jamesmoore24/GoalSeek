"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Bot, User, ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ChatHistory,
  Message,
  ChatNode,
  MessageContent,
  TextContent,
  ImageContent,
} from "@/types/chat";
import { ModelType, TokenUsage } from "@/types/tokenUsage";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "./chat-message";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";

const modelConfigs = {
  "llama-3.1-8b": {
    name: "Llama 3.1 (8B)",
    pricing: {
      inputTokensCached: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  },
  "llama-3.3-70b": {
    name: "Llama 3.3 (70B)",
    pricing: {
      inputTokensCached: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  },
  "llama-4-scout-17b-16e-instruct": {
    name: "Llama 4 Scout (17B)",
    pricing: {
      inputTokensCached: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  },
  "qwen-3-32b": {
    name: "Qwen 3 (32B)",
    pricing: {
      inputTokensCached: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  },
  "deepseek-chat": {
    name: "DeepSeek Chat",
    pricing: {
      inputTokensCached: 0.014,
      inputTokens: 0.14,
      outputTokens: 0.28,
    },
  },
  "deepseek-reasoner": {
    name: "DeepSeek Reasoner",
    pricing: {
      inputTokensCached: 0.14,
      inputTokens: 0.55,
      outputTokens: 2.19,
    },
  },
  "gpt-4o": {
    name: "GPT-4o (Multimodal)",
    pricing: {
      inputTokensCached: 1.25,
      inputTokens: 2.5,
      outputTokens: 10.0,
    },
  },
  auto: {
    name: "Auto Router",
    pricing: {
      inputTokensCached: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  },
} as const;

export default function ChatInterface() {
  const [chatNodes, setChatNodes] = useState<Map<string, ChatNode>>(new Map());
  const [messageContext, setMessageContext] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFirstToken, setIsLoadingFirstToken] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>("gpt-4o");
  const [tokenUsage, setTokenUsage] = useState<Map<string, TokenUsage>>(
    new Map()
  );
  const [uploadedImages, setUploadedImages] = useState<ImageContent[]>([]);

  const [currentChatId] = useState(crypto.randomUUID());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear uploaded images when model changes away from GPT-4o
  useEffect(() => {
    if (selectedModel !== "gpt-4o" && uploadedImages.length > 0) {
      setUploadedImages([]);
    }
  }, [selectedModel, uploadedImages.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 12), 96); // Min 1 line (~24px), Max 4 lines (~96px)
    textarea.style.height = `${newHeight}px`;
  };

  const handleImageUpload = (files: FileList | null) => {
    if (!files || selectedModel !== "gpt-4o") return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          const imageContent: ImageContent = {
            type: "image_url",
            image_url: {
              url: base64,
              detail: "high",
            },
          };
          setUploadedImages((prev) => [...prev, imageContent]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const createMessageContent = (
    text: string,
    images: ImageContent[]
  ): MessageContent => {
    if (images.length === 0) {
      return text;
    }

    const content: (TextContent | ImageContent)[] = [
      { type: "text", text },
      ...images,
    ];

    return content;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setIsLoadingFirstToken(true);
    const userInput = input;
    const currentImages = [...uploadedImages];
    setInput("");
    setUploadedImages([]);

    // Create message content with text and images
    const messageContent = createMessageContent(userInput, currentImages);

    // Create messages array for API call
    const newMessages = [
      ...messageContext.flatMap((nodeId) => {
        const node = chatNodes.get(nodeId);
        if (!node) return [];
        return [
          { content: node.query, isUser: true },
          { content: node.response, isUser: false },
        ];
      }),
      { content: messageContent, isUser: true },
    ];

    const newChatNodeID = `${currentChatId}-${chatNodes.size}`;

    // Create the new node object
    const newNode: ChatNode = {
      id: newChatNodeID,
      parentId:
        messageContext.length > 0
          ? messageContext[messageContext.length - 1]
          : null,
      children: [],
      query: messageContent,
      response: "",
      model: modelConfigs[selectedModel].name,
    };

    // Initialize the node in chatNodes
    setChatNodes((prev) => {
      const updated = new Map(prev);
      updated.set(newChatNodeID, newNode);

      // Update parent's children array if there is a parent
      if (newNode.parentId) {
        const parentNode = updated.get(newNode.parentId);
        if (parentNode) {
          updated.set(newNode.parentId, {
            ...parentNode,
            children: [...parentNode.children, newNode.id],
          });
        }
      }

      return updated;
    });

    // Update messageContext with the new node's ID
    setMessageContext([...messageContext, newNode.id]);

    try {
      // Convert messages to appropriate format for the selected model
      const formatMessageForModel = (
        content: MessageContent,
        modelType: ModelType
      ) => {
        // GPT-4o can handle multimodal content
        if (modelType === "gpt-4o") {
          return content;
        }

        // Other models need text-only content
        if (typeof content === "string") {
          return content;
        }

        // Extract text from multimodal content
        return content
          .filter((item) => item.type === "text")
          .map((item) => (item as TextContent).text)
          .join(" ");
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((msg) => ({
            role: msg.isUser ? "user" : "assistant",
            content: formatMessageForModel(msg.content, selectedModel),
          })),
          model: selectedModel,
          autoRouteEnabled: false,
        }),
      });

      if (!response.ok) throw new Error(response.statusText);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let fullResponse = "";
      let fullReasoning = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setIsLoadingFirstToken(false);

        const lines = chunk.split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const update = JSON.parse(line);

            // Handle model update from auto router
            if (update.selectedModel) {
              // Update the node's model name with the actual selected model
              setChatNodes((prev) => {
                const updated = new Map(prev);
                const nodeToUpdate = updated.get(newChatNodeID);
                if (nodeToUpdate) {
                  updated.set(newChatNodeID, {
                    ...nodeToUpdate,
                    model: modelConfigs[update.selectedModel as ModelType].name,
                  });
                }
                return updated;
              });
            }

            // Handle reasoning content
            if (update.reasoning) {
              fullReasoning += update.reasoning;
              // Update the node's response in chatNodes with reasoning
              setChatNodes((prev) => {
                const updated = new Map(prev);
                const nodeToUpdate = updated.get(newChatNodeID);
                if (nodeToUpdate) {
                  updated.set(newChatNodeID, {
                    ...nodeToUpdate,
                    response:
                      `Reasoning:\n${fullReasoning}\n\nResponse:\n${fullResponse}`.replace(
                        /\n\n/g,
                        "\n"
                      ),
                  });
                }
                return updated;
              });
            } else if (update.content) {
              fullResponse += update.content;
              // Update the node's response in chatNodes
              setChatNodes((prev) => {
                const updated = new Map(prev);
                const nodeToUpdate = updated.get(newChatNodeID);
                if (nodeToUpdate) {
                  const response = fullReasoning
                    ? `Reasoning:\n${fullReasoning}\n\nResponse:\n${fullResponse}`
                    : fullResponse;
                  updated.set(newChatNodeID, {
                    ...nodeToUpdate,
                    response: response.replace(/\n\n/g, "\n"),
                  });
                }
                return updated;
              });
            }

            // Update token usage if available
            if (update.modelInfo?.usage) {
              setTokenUsage((prev) => {
                const updated = new Map(prev);
                updated.set(newChatNodeID, {
                  inputTokens: update.modelInfo.usage.inputTokens,
                  outputTokens: update.modelInfo.usage.outputTokens,
                  cached: update.modelInfo.usage.cached,
                });
                return updated;
              });
            }
          } catch (e) {
            console.error("Error parsing chunk:", e);
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error:", error);
      setIsLoading(false);
    }
  };

  // Convert chatNodes to messages for display
  const messages = messageContext.flatMap((nodeId) => {
    const node = chatNodes.get(nodeId);
    if (!node) return [];

    const userMessage = {
      id: `${nodeId}-user`,
      role: "user",
      content: node.query,
    };

    const assistantMessage = {
      id: `${nodeId}-assistant`,
      role: "assistant",
      content: node.response,
      model: node.model,
      isLoading:
        isLoading && nodeId === messageContext[messageContext.length - 1],
    };

    return [userMessage, assistantMessage];
  });

  return (
    <div
      className="relative"
      style={{
        height: "100dvh", // Dynamic viewport height for mobile
        maxHeight: "100dvh",
        overflow: "hidden",
      }}
    >
      {/* Model Selection - Fixed at top */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center space-x-3 p-4 bg-white border-b border-gray-200"
        style={{
          paddingTop: "calc(1rem + env(safe-area-inset-top))",
        }}
      >
        <div className="flex items-center space-x-2">
          <Bot className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Model:</span>
        </div>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value as ModelType)}
          disabled={isLoading}
          className="flex-1 h-8 text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {Object.entries(modelConfigs)
            .filter(([key]) => key !== "auto") // Remove auto option
            .map(([key, config]) => {
              const getModelIcon = () => {
                if (key.includes("deepseek")) return "🧠";
                if (key.includes("llama")) return "🦙";
                if (key.includes("qwen")) return "🤖";
                return "🤖";
              };

              return (
                <option key={key} value={key}>
                  {getModelIcon()} {config.name}
                </option>
              );
            })}
        </select>
      </div>

      {/* Messages - Scrollable area between fixed top and bottom */}
      <div
        className="absolute left-0 right-0 overflow-y-auto"
        style={{
          top: "calc(65px + env(safe-area-inset-top))", // Model selector height + safe area
          bottom: "calc(100px + env(safe-area-inset-bottom))", // Input area height + safe area
          padding: "16px",
          WebkitOverflowScrolling: "touch",
          overflowAnchor: "none",
        }}
      >
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message) => {
            // Parse reasoning from the response if present
            const parseResponse = (response: string) => {
              const reasoningMatch = response.match(
                /Reasoning:\s*([\s\S]*?)\s*Response:\s*([\s\S]*)/
              );
              if (reasoningMatch) {
                return {
                  reasoning: reasoningMatch[1].trim(),
                  content: reasoningMatch[2].trim(),
                };
              }
              return {
                reasoning: undefined,
                content: response.trim(),
              };
            };

            const { reasoning, content } =
              message.role === "assistant"
                ? parseResponse(
                    typeof message.content === "string" ? message.content : ""
                  )
                : { reasoning: undefined, content: message.content };

            return (
              <ChatMessage
                key={message.id}
                message={{
                  content:
                    message.role === "user"
                      ? content
                      : (content as MessageContent),
                  isUser: message.role === "user",
                  reasoning,
                  model:
                    "model" in message ? (message.model as string) : undefined,
                }}
                isSelected={false}
                isRecent={true}
                inInsertMode={true}
                isLoading={
                  "isLoading" in message
                    ? (message.isLoading as boolean)
                    : false
                }
              />
            );
          })}
        </div>
      </div>

      {/* Input - Fixed at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-white border-t border-gray-200"
        style={{
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
          backgroundColor: "white",
        }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Image Preview - Only show when GPT-4o is selected */}
          {selectedModel === "gpt-4o" && uploadedImages.length > 0 && (
            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
              <div className="flex flex-wrap gap-2">
                {uploadedImages.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={image.image_url.url}
                      alt={`Upload ${index + 1}`}
                      className="w-16 h-16 object-cover rounded border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleImageUpload(e.target.files)}
              accept="image/*"
              multiple
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                if (selectedModel === "gpt-4o") {
                  fileInputRef.current?.click();
                }
              }}
              disabled={isLoading || selectedModel !== "gpt-4o"}
              className={cn(
                "flex-shrink-0",
                selectedModel !== "gpt-4o" && "opacity-50 cursor-not-allowed"
              )}
              title={
                selectedModel !== "gpt-4o"
                  ? "Image upload is only available with GPT-4o"
                  : "Upload image"
              }
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Ask me anything about your goals, schedule, or what to do next..."
              className="flex-1 min-h-[12px] max-h-[96px] resize-none overflow-y-auto"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              autoFocus={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{
                WebkitAppearance: "none",
                WebkitBorderRadius: "0.375rem",
                WebkitUserSelect: "text",
                WebkitTouchCallout: "none",
                WebkitTapHighlightColor: "transparent",
                fontSize: "16px", // Prevents zoom on iOS Safari
              }}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
