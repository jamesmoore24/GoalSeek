"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { filterCommands, type SlashCommand } from "@/lib/commands/registry";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  BarChart,
  Target,
  PenLine,
  Clock,
  Calendar,
  CheckCircle,
  Command,
} from "lucide-react";

// Map icon names to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  BarChart,
  Target,
  PenLine,
  Clock,
  Calendar,
  CheckCircle,
  Command,
};

interface CommandPickerProps {
  query: string;
  visible: boolean;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
}

export function CommandPicker({
  query,
  visible,
  onSelect,
  onClose,
  selectedIndex,
  onSelectedIndexChange,
}: CommandPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const filteredCommands = filterCommands(query);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [visible, onClose]);

  // Reset selected index when query changes
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      onSelectedIndexChange(Math.max(0, filteredCommands.length - 1));
    }
  }, [query, filteredCommands.length, selectedIndex, onSelectedIndexChange]);

  if (!visible || filteredCommands.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-popover border rounded-lg shadow-lg overflow-hidden z-50"
    >
      {/* Header */}
      <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-muted/30 flex items-center gap-2">
        <Command className="h-3 w-3" />
        <span>Commands</span>
        <span className="ml-auto text-[10px]">↑↓ navigate · Enter select · Esc close</span>
      </div>

      {/* Command List */}
      <div className="py-1 max-h-64 overflow-y-auto">
        {filteredCommands.map((cmd, index) => {
          const Icon = iconMap[cmd.icon] || Command;
          const isSelected = index === selectedIndex;

          return (
            <button
              key={cmd.name}
              onClick={() => onSelect(cmd)}
              onMouseEnter={() => onSelectedIndexChange(index)}
              className={cn(
                "w-full px-3 py-2.5 flex items-start gap-3 transition-colors text-left",
                isSelected ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-md shrink-0",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">/{cmd.name}</span>
                  {cmd.args && cmd.args.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {cmd.args.map((arg) => (
                        <span key={arg.name}>
                          {arg.optional ? `[${arg.name}]` : `<${arg.name}>`}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {cmd.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      {filteredCommands.length > 0 && filteredCommands[selectedIndex]?.args && (
        <div className="px-3 py-2 text-xs text-muted-foreground border-t bg-muted/30">
          <span className="font-medium">Tip:</span> Press Tab to autocomplete, then add arguments
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage command picker state and keyboard navigation
 */
export function useCommandPicker() {
  const [showPicker, setShowPicker] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = filterCommands(commandQuery);

  const handleInputChange = useCallback((value: string) => {
    if (value.startsWith("/")) {
      setShowPicker(true);
      setCommandQuery(value.slice(1).split(" ")[0]); // Only use first word after /
    } else {
      setShowPicker(false);
      setCommandQuery("");
    }
  }, []);

  const closePicker = useCallback(() => {
    setShowPicker(false);
    setCommandQuery("");
    setSelectedIndex(0);
  }, []);

  const moveSelection = useCallback(
    (direction: "up" | "down") => {
      if (!showPicker || filteredCommands.length === 0) return;

      setSelectedIndex((prev) => {
        if (direction === "up") {
          return prev <= 0 ? filteredCommands.length - 1 : prev - 1;
        } else {
          return prev >= filteredCommands.length - 1 ? 0 : prev + 1;
        }
      });
    },
    [showPicker, filteredCommands.length]
  );

  const getSelectedCommand = useCallback((): SlashCommand | null => {
    if (!showPicker || filteredCommands.length === 0) return null;
    return filteredCommands[selectedIndex] || null;
  }, [showPicker, filteredCommands, selectedIndex]);

  return {
    showPicker,
    commandQuery,
    selectedIndex,
    filteredCommands,
    setSelectedIndex,
    handleInputChange,
    closePicker,
    moveSelection,
    getSelectedCommand,
  };
}
