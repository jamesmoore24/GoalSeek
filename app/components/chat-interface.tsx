"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatHistory, Message, ChatNode } from "@/types/chat";
import { ModelType, TokenUsage } from "@/types/tokenUsage";
import { Textarea } from "@/components/ui/textarea";
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
  const [selectedModel, setSelectedModel] = useState<ModelType>("llama-3.1-8b");
  const [tokenUsage, setTokenUsage] = useState<Map<string, TokenUsage>>(
    new Map()
  );

  const [currentChatId] = useState(crypto.randomUUID());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 12), 96); // Min 1 line (~24px), Max 4 lines (~96px)
    textarea.style.height = `${newHeight}px`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setIsLoadingFirstToken(true);
    const userInput = input;
    setInput("");

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
      { content: userInput, isUser: true },
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
      query: userInput,
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((msg) => ({
            role: msg.isUser ? "user" : "assistant",
            content: msg.content,
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

    // Only include assistant message if it has content
    if (node.response.trim()) {
      return [
        userMessage,
        {
          id: `${nodeId}-assistant`,
          role: "assistant",
          content: node.response,
        },
      ];
    }

    return [userMessage];
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
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>

              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {isLoading && messageContext.length > 0 && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                {isLoadingFirstToken ? (
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                ) : (
                  <div className="w-2 h-4 bg-gray-400 animate-pulse"></div>
                )}
              </div>
            </div>
          )}
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
        <form
          onSubmit={handleSubmit}
          className="flex space-x-2 max-w-4xl mx-auto"
        >
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
  );
}
