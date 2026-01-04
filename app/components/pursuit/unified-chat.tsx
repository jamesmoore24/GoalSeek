"use client";

import { useState, useRef, useEffect } from "react";
import type { Pursuit, PursuitProgress } from "@/types/pursuit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Sparkles, Bookmark, Camera, X, ImageIcon, ChevronLeft, ChevronRight, Check, Loader2, AlertCircle, MinusCircle, Brain, Target, Calendar, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePhotoPicker, MediaPhoto } from "@/hooks/use-photo-picker";
import { InlinePhotoPicker } from "@/app/components/inline-photo-picker";
import { MemoryPreviewModal, ExtractedMemory } from "@/app/components/pursuit/memory-preview-modal";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // base64 image URLs
  functionCalls?: Array<{
    function: string;
    result: any;
  }>;
}

interface UnifiedChatProps {
  selectedPursuitId?: string;
  pursuits: Pursuit[];
  progress: Map<string, PursuitProgress>;
  onDataChange?: () => void;
}

interface SelectedImage {
  id: string;
  preview: string; // base64 or webPath for preview
  base64?: string; // full base64 for sending
}

// Pipeline status types
type StatusStep = 'memories' | 'pursuits' | 'calendar' | 'garmin' | 'generating';
type StatusState = 'loading' | 'complete' | 'skipped' | 'error' | 'idle';

interface PipelineStatus {
  memories: { status: StatusState; message?: string; detail?: string };
  pursuits: { status: StatusState; message?: string; detail?: string };
  calendar: { status: StatusState; message?: string; detail?: string };
  garmin: { status: StatusState; message?: string; detail?: string };
  generating: { status: StatusState; message?: string; detail?: string };
}

const initialPipelineStatus: PipelineStatus = {
  memories: { status: 'idle' },
  pursuits: { status: 'idle' },
  calendar: { status: 'idle' },
  garmin: { status: 'idle' },
  generating: { status: 'idle' },
};

export function UnifiedChat({ selectedPursuitId, pursuits, progress, onDataChange }: UnifiedChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>(initialPipelineStatus);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Memory extraction state
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedMemories, setExtractedMemories] = useState<ExtractedMemory[]>([]);

  const {
    isNative,
    isLoading: isLoadingPhotos,
    isPickerOpen,
    recentPhotos,
    openPicker,
    closePicker,
    selectPhotos,
  } = usePhotoPicker();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const selectedPursuit = pursuits.find(p => p.id === selectedPursuitId);
  const selectedProgress = selectedPursuitId ? progress.get(selectedPursuitId) : null;

  const handleSend = async () => {
    if ((!input.trim() && selectedImages.length === 0) || isLoading) return;

    // Build message content - can be string or array with images
    const imageContents = selectedImages.length > 0
      ? selectedImages.map(img => ({
          type: 'image_url' as const,
          image_url: { url: img.base64 || img.preview }
        }))
      : [];

    const messageContent = selectedImages.length > 0
      ? [
          ...imageContents,
          { type: 'text' as const, text: input || 'What do you see in this image?' }
        ]
      : input;

    // Store images with the message for display
    const imageUrls = selectedImages.map(img => img.base64 || img.preview);
    const userMessage: Message = {
      role: 'user',
      content: input || 'What do you see in this image?',
      images: imageUrls.length > 0 ? imageUrls : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setSelectedImages([]);
    setIsLoading(true);
    setPipelineStatus(initialPipelineStatus); // Reset pipeline status

    try {
      // Convert message history to API format (handle images properly)
      const apiMessages = [...messages, userMessage].map(msg => {
        if (msg.images && msg.images.length > 0) {
          // Convert to multimodal format
          return {
            role: msg.role,
            content: [
              ...msg.images.map(img => ({
                type: 'image_url' as const,
                image_url: { url: img }
              })),
              { type: 'text' as const, text: msg.content }
            ]
          };
        }
        // Plain text message
        return { role: msg.role, content: msg.content };
      });

      const response = await fetch("/api/chat/unified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_pursuit_id: selectedPursuitId,
          messages: apiMessages,
          include_all_pursuits: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantMessage = "";
      const functionCalls: any[] = [];
      let buffer = "";

      // Add initial assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            if (data.type === "status") {
              // Update pipeline status
              setPipelineStatus(prev => ({
                ...prev,
                [data.step]: {
                  status: data.status,
                  message: data.message,
                  detail: data.detail,
                },
              }));
            } else if (data.type === "content") {
              assistantMessage += data.content;
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg?.role === 'assistant') {
                  lastMsg.content = assistantMessage;
                }
                return newMessages;
              });
            } else if (data.type === "function_result") {
              functionCalls.push(data);
              toast.success(`✓ ${data.result.message || `Executed: ${data.function}`}`);
              if (onDataChange) onDataChange();
            } else if (data.type === "function_error") {
              toast.error(`Error: ${data.error}`);
            }
          } catch (e) {
            console.warn("Failed to parse chunk:", line);
          }
        }
      }

      // Final message update with function calls
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg?.role === 'assistant') {
          lastMsg.functionCalls = functionCalls.length > 0 ? functionCalls : undefined;
        }
        return newMessages;
      });

    } catch (error: any) {
      console.error("Chat error:", error);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Open modal and start extracting memories
  const handleSaveMemory = async () => {
    if (messages.length === 0 || isSavingMemory) return;

    // Open modal and start extraction
    setIsMemoryModalOpen(true);
    setIsExtracting(true);
    setExtractedMemories([]);

    try {
      const selectedPursuit = pursuits.find(p => p.id === selectedPursuitId);
      const response = await fetch("/api/memories/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          pursuit_name: selectedPursuit?.name || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to extract memories");
      }

      const data = await response.json();
      setExtractedMemories(data.memories || []);
    } catch (error: any) {
      console.error("Failed to extract memories:", error);
      toast.error(error.message || "Failed to extract memories");
      setIsMemoryModalOpen(false);
    } finally {
      setIsExtracting(false);
    }
  };

  // Save the extracted memories to database
  const handleSaveExtractedMemories = async (memories: ExtractedMemory[]) => {
    setIsSavingMemory(true);
    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memories,
          pursuit_id: selectedPursuitId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save memories");
      }

      const data = await response.json();
      toast.success(`Saved ${data.count} memories`);
      setIsMemoryModalOpen(false);
      setExtractedMemories([]);
    } catch (error: any) {
      console.error("Failed to save memories:", error);
      toast.error(error.message || "Failed to save memories");
    } finally {
      setIsSavingMemory(false);
    }
  };

  // Update a memory in the preview
  const handleUpdateMemory = (index: number, memory: ExtractedMemory) => {
    setExtractedMemories(prev => {
      const updated = [...prev];
      updated[index] = memory;
      return updated;
    });
  };

  // Remove a memory from the preview
  const handleRemoveMemory = (index: number) => {
    setExtractedMemories(prev => prev.filter((_, i) => i !== index));
  };

  // Close the memory modal
  const handleCloseMemoryModal = () => {
    setIsMemoryModalOpen(false);
    setExtractedMemories([]);
  };

  // Handle camera/photo button click
  const handleCameraClick = () => {
    if (isNative) {
      openPicker();
    } else {
      fileInputRef.current?.click();
    }
  };

  // Handle native photo selection
  const handleNativePhotoSelect = async (photos: MediaPhoto[]) => {
    const images = await selectPhotos(photos);
    const newImages: SelectedImage[] = images.map((img, idx) => ({
      id: `native-${Date.now()}-${idx}`,
      preview: img.image_url.url,
      base64: img.image_url.url,
    }));
    setSelectedImages(prev => [...prev, ...newImages].slice(0, 4));
  };

  // Handle web file input change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: SelectedImage[] = [];
    for (let i = 0; i < Math.min(files.length, 4 - selectedImages.length); i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const base64 = await fileToBase64(file);
      newImages.push({
        id: `file-${Date.now()}-${i}`,
        preview: base64,
        base64: base64,
      });
    }

    setSelectedImages(prev => [...prev, ...newImages].slice(0, 4));
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove a selected image
  const removeImage = (id: string) => {
    setSelectedImages(prev => prev.filter(img => img.id !== id));
  };

  // Handle paste event for images
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageItems.push(file);
      }
    }

    if (imageItems.length === 0) return;

    // Process pasted images
    const newImages: SelectedImage[] = [];
    for (let i = 0; i < Math.min(imageItems.length, 4 - selectedImages.length); i++) {
      const file = imageItems[i];
      const base64 = await fileToBase64(file);
      newImages.push({
        id: `paste-${Date.now()}-${i}`,
        preview: base64,
        base64: base64,
      });
    }

    if (newImages.length > 0) {
      setSelectedImages(prev => [...prev, ...newImages].slice(0, 4));
      toast.success(`Pasted ${newImages.length} image${newImages.length > 1 ? 's' : ''}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Context indicator */}
      {selectedPursuit && (
        <div className="px-4 py-2 border-b flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedPursuit.color }}
              />
              <span className="text-sm font-medium">{selectedPursuit.name}</span>
            </div>
            {selectedProgress && (
              <Badge variant="outline" className="text-xs">
                {selectedProgress.hours_logged.toFixed(1)}h / {selectedProgress.hours_target}h this week
              </Badge>
            )}
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear chat
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
            <Bot className="h-16 w-16 mb-4 opacity-20" />
            <p className="font-medium mb-2">
              {selectedPursuit ? `Managing: ${selectedPursuit.name}` : 'General Assistant'}
            </p>
            <p className="text-sm max-w-md mb-4">
              I have full context of your pursuits and can help you:
            </p>
            <ul className="text-xs space-y-1 text-left max-w-md">
              <li>• Create and update subgoals with execution strategies</li>
              <li>• Rebalance time between pursuits</li>
              <li>• Track progress and suggest adjustments</li>
              <li>• Analyze your weekly performance</li>
            </ul>
          </div>
        ) : (
          messages.map((message, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-3 items-start",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[85%] rounded-lg p-3 shadow-sm",
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border',
                  // Make the bubble wider when showing pipeline status
                  message.role === 'assistant' && isLoading && idx === messages.length - 1 && !message.content && 'min-w-[220px]'
                )}
              >
                {/* Image carousel */}
                {message.images && message.images.length > 0 && (
                  <MessageImageCarousel images={message.images} />
                )}

                {/* Show pipeline status for loading assistant messages */}
                {message.role === 'assistant' && isLoading && idx === messages.length - 1 && (
                  <div className={cn(message.content && "mb-3 pb-3 border-b border-border/50")}>
                    <PipelineStatusDisplay status={pipelineStatus} />
                  </div>
                )}

                {/* Message content */}
                {message.content && (
                  <div className={cn(
                      "text-sm prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2",
                      message.role === 'user'
                        ? "[&_*]:text-inherit"
                        : "dark:prose-invert"
                    )}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                )}

                {message.functionCalls && message.functionCalls.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Sparkles className="h-3 w-3" />
                      <span>Actions taken:</span>
                    </div>
                    {message.functionCalls.map((call, i) => (
                      <Badge key={i} variant="secondary" className="text-xs mr-1">
                        {call.result.message || call.function}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-5 w-5" />
                </div>
              )}
            </div>
          ))
        )}


        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-card">
        {/* Native Photo Picker */}
        {isNative && (
          <InlinePhotoPicker
            photos={recentPhotos}
            isOpen={isPickerOpen}
            isLoading={isLoadingPhotos}
            onClose={closePicker}
            onSelect={handleNativePhotoSelect}
            maxSelections={4 - selectedImages.length}
          />
        )}

        {/* Photo Previews */}
        {selectedImages.length > 0 && (
          <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
            {selectedImages.map((img) => (
              <div key={img.id} className="relative shrink-0">
                <img
                  src={img.preview}
                  alt="Selected"
                  className="w-16 h-16 rounded-lg object-cover border"
                />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1.5 -right-1.5 bg-black/70 hover:bg-black rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Row */}
        <div className="p-4 flex gap-2 items-end">
          {/* Camera/Photo Button */}
          <Button
            onClick={handleCameraClick}
            disabled={isLoading || selectedImages.length >= 4}
            size="icon"
            variant="outline"
            className="shrink-0 h-10 w-10 self-end"
            title="Add photo"
          >
            {isNative ? (
              <Camera className="h-5 w-5" />
            ) : (
              <ImageIcon className="h-5 w-5" />
            )}
          </Button>

          {/* Hidden file input for web */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Text Input */}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              selectedPursuit
                ? `Ask about ${selectedPursuit.name}...`
                : "Ask about your pursuits..."
            }
            className="resize-none flex-1 min-h-10 py-2"
            rows={1}
          />

          {/* Save Memory Button */}
          <Button
            onClick={handleSaveMemory}
            disabled={isSavingMemory || messages.length === 0}
            size="icon"
            variant="ghost"
            className="shrink-0 h-10 w-10 self-end"
            title="Save conversation as memory"
          >
            <Bookmark className={cn("h-5 w-5", isSavingMemory && "animate-pulse")} />
          </Button>
        </div>
      </div>

      {/* Memory Preview Modal */}
      <MemoryPreviewModal
        isOpen={isMemoryModalOpen}
        isLoading={isExtracting}
        memories={extractedMemories}
        onClose={handleCloseMemoryModal}
        onSave={handleSaveExtractedMemories}
        onUpdateMemory={handleUpdateMemory}
        onRemoveMemory={handleRemoveMemory}
      />
    </div>
  );
}

// Helper function to convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Pipeline status display component
function PipelineStatusDisplay({ status }: { status: PipelineStatus }) {
  const steps: Array<{ key: StatusStep; label: string; icon: React.ReactNode }> = [
    { key: 'memories', label: 'Memories', icon: <Brain className="h-3.5 w-3.5" /> },
    { key: 'pursuits', label: 'Pursuits', icon: <Target className="h-3.5 w-3.5" /> },
    { key: 'calendar', label: 'Calendar', icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: 'garmin', label: 'Garmin', icon: <Activity className="h-3.5 w-3.5" /> },
    { key: 'generating', label: 'AI', icon: <Sparkles className="h-3.5 w-3.5" /> },
  ];

  // Check if any step is active (not idle)
  const hasActivity = Object.values(status).some(s => s.status !== 'idle');
  if (!hasActivity) {
    return (
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {steps.map(({ key, label, icon }) => {
        const stepStatus = status[key];
        if (stepStatus.status === 'idle') return null;

        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <div className={cn(
              "flex items-center justify-center w-5 h-5 rounded-full",
              stepStatus.status === 'loading' && "text-blue-500",
              stepStatus.status === 'complete' && "text-green-500",
              stepStatus.status === 'skipped' && "text-muted-foreground",
              stepStatus.status === 'error' && "text-red-500",
            )}>
              {stepStatus.status === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {stepStatus.status === 'complete' && <Check className="h-3.5 w-3.5" />}
              {stepStatus.status === 'skipped' && <MinusCircle className="h-3.5 w-3.5" />}
              {stepStatus.status === 'error' && <AlertCircle className="h-3.5 w-3.5" />}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {icon}
              <span className={cn(
                stepStatus.status === 'loading' && "text-foreground",
                stepStatus.status === 'complete' && "text-muted-foreground",
              )}>
                {stepStatus.message || label}
              </span>
              {stepStatus.detail && (
                <span className="text-muted-foreground/60">({stepStatus.detail})</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Image carousel component for message images
function MessageImageCarousel({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  if (images.length === 1) {
    return (
      <div className="mb-2">
        <img
          src={images[0]}
          alt="Attached"
          className="rounded-md max-h-48 w-auto object-contain"
        />
      </div>
    );
  }

  return (
    <div className="mb-2 relative">
      <img
        src={images[currentIndex]}
        alt={`Attached ${currentIndex + 1}`}
        className="rounded-md max-h-48 w-auto object-contain"
      />

      {/* Navigation controls */}
      <div className="flex items-center justify-between mt-1.5">
        <button
          onClick={goToPrevious}
          className="p-1 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-white" />
        </button>

        <span className="text-xs opacity-80">
          {currentIndex + 1} / {images.length}
        </span>

        <button
          onClick={goToNext}
          className="p-1 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  );
}
