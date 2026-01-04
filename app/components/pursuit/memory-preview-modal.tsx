"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Trash2, Pencil, Check, X, Brain, Lightbulb, Target, CheckSquare, Heart, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

// Memory type from extraction
export interface ExtractedMemory {
  content: string;
  type: 'insight' | 'decision' | 'fact' | 'commitment' | 'preference' | 'goal' | 'other';
  tags: string[];
  importance: number;
}

interface MemoryPreviewModalProps {
  isOpen: boolean;
  isLoading: boolean;
  memories: ExtractedMemory[];
  onClose: () => void;
  onSave: (memories: ExtractedMemory[]) => Promise<void>;
  onUpdateMemory: (index: number, memory: ExtractedMemory) => void;
  onRemoveMemory: (index: number) => void;
}

// Icon mapping for memory types
const typeIcons: Record<string, React.ReactNode> = {
  insight: <Lightbulb className="h-3.5 w-3.5" />,
  decision: <CheckSquare className="h-3.5 w-3.5" />,
  fact: <Brain className="h-3.5 w-3.5" />,
  commitment: <Target className="h-3.5 w-3.5" />,
  preference: <Heart className="h-3.5 w-3.5" />,
  goal: <Flag className="h-3.5 w-3.5" />,
  other: <Brain className="h-3.5 w-3.5" />,
};

// Color mapping for memory types
const typeColors: Record<string, string> = {
  insight: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  decision: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fact: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  commitment: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  preference: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  goal: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function MemoryPreviewModal({
  isOpen,
  isLoading,
  memories,
  onClose,
  onSave,
  onUpdateMemory,
  onRemoveMemory,
}: MemoryPreviewModalProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = (index: number, content: string) => {
    setEditingIndex(index);
    setEditContent(content);
  };

  const handleSaveEdit = (index: number) => {
    if (editContent.trim()) {
      onUpdateMemory(index, {
        ...memories[index],
        content: editContent.trim(),
      });
    }
    setEditingIndex(null);
    setEditContent("");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditContent("");
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await onSave(memories);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {isLoading ? "Extracting Memories..." : `${memories.length} Memories Extracted`}
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Analyzing your conversation to identify key takeaways..."
              : "Review and edit the extracted memories before saving. You can remove any that aren't useful."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Analyzing conversation...</p>
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No memorable content found</p>
              <p className="text-sm mt-2 max-w-sm mx-auto">
                This conversation didn't contain specific personal information, decisions, or commitments worth remembering.
              </p>
              <p className="text-xs mt-4 opacity-70">
                Memories are extracted from things like goals, decisions, personal facts, and specific commitments.
              </p>
            </div>
          ) : (
            memories.map((memory, index) => (
              <div
                key={index}
                className="border rounded-lg p-3 bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start gap-2">
                  {/* Type badge */}
                  <Badge
                    variant="secondary"
                    className={cn("shrink-0 flex items-center gap-1", typeColors[memory.type])}
                  >
                    {typeIcons[memory.type]}
                    <span className="capitalize">{memory.type}</span>
                  </Badge>

                  {/* Importance indicator */}
                  <Badge variant="outline" className="shrink-0">
                    {memory.importance}/10
                  </Badge>

                  <div className="flex-1" />

                  {/* Edit/Delete buttons */}
                  {editingIndex !== index && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleStartEdit(index, memory.content)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onRemoveMemory(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Content */}
                {editingIndex === index ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[80px]"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleSaveEdit(index)}>
                        <Check className="h-4 w-4 mr-1" /> Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm">{memory.content}</p>
                )}

                {/* Tags */}
                {memory.tags.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {memory.tags.map((tag, tagIndex) => (
                      <Badge key={tagIndex} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={isLoading || memories.length === 0 || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              `Save ${memories.length} Memories`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
