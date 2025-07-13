export interface ImageContent {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

export interface TextContent {
  type: "text";
  text: string;
}

export type MessageContent = string | (TextContent | ImageContent)[];

export interface Message {
  content: MessageContent;
  isUser: boolean;
}

export interface ChatNode {
  id: string;
  parentId: string | null;
  children: string[];
  query: MessageContent;
  response: string;
  model: string;
}

export interface ChatHistory {
  id: string;
  title: string;
  timestamp: Date;
  messageContext: string[];
  chatNodes: Map<string, ChatNode>;
}
