"use client";

import { useState } from "react";
import type { Pursuit, PursuitProgress } from "@/types/pursuit";
import { cn } from "@/lib/utils";
import { Plus, Zap, Sparkles, ChevronDown } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface PursuitTabBarProps {
  pursuits: Pursuit[];
  progress: Map<string, PursuitProgress>;
  selectedPursuitId?: string;
  onSelectPursuit: (pursuitId: string) => void;
  onAddPursuit: () => void;
  onRunWorkflow?: (workflowSlug: string, options?: Record<string, unknown>) => void;
}

export function PursuitTabBar({
  pursuits,
  progress,
  selectedPursuitId,
  onSelectPursuit,
  onAddPursuit,
  onRunWorkflow,
}: PursuitTabBarProps) {
  const getTabColor = (pursuitId: string) => {
    const prog = progress.get(pursuitId);
    if (!prog) return 'bg-gray-400';

    const percentage = prog.progress_percentage;
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getProgressPercentage = (pursuitId: string) => {
    const prog = progress.get(pursuitId);
    return prog?.progress_percentage || 0;
  };

  return (
    <div className="sticky top-0 z-10 bg-background border-b">
      <div className="flex items-center justify-between gap-2 p-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
          {pursuits.map((pursuit) => {
            const isSelected = pursuit.id === selectedPursuitId;
            const progressPct = getProgressPercentage(pursuit.id);

            return (
              <button
                key={pursuit.id}
                onClick={() => onSelectPursuit(pursuit.id)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all shrink-0 text-white",
                  getTabColor(pursuit.id),
                  isSelected && "ring-2 ring-offset-2 ring-foreground scale-105",
                  !isSelected && "opacity-80 hover:opacity-100"
                )}
              >
                {pursuit.name.toUpperCase()} {progressPct.toFixed(0)}%
              </button>
            );
          })}

          {/* Add Pursuit Button */}
          <button
            onClick={onAddPursuit}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-all shrink-0 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Pursuit
          </button>
        </div>

        {/* Workflows Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9"
            >
              <Zap className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Workflows</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRunWorkflow?.('planmyday')}
              className="cursor-pointer"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              <div className="flex-1">
                <div className="font-medium">Plan My Day</div>
                <div className="text-xs text-muted-foreground">
                  Generate an optimized agenda
                </div>
              </div>
            </DropdownMenuItem>
            {/* Future workflows can be added here */}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu on the right */}
        <div className="shrink-0">
          <UserMenu />
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
