export interface Message {
  content: string;
  isUser: boolean;
}

export interface ChatNode {
  id: string;
  parentId: string | null;
  children: string[];
  query: string;
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
