"use client";

import type { Pursuit, PursuitProgress } from "@/types/pursuit";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { UserMenu } from "@/components/user-menu";

interface PursuitTabBarProps {
  pursuits: Pursuit[];
  progress: Map<string, PursuitProgress>;
  selectedPursuitId?: string;
  onSelectPursuit: (pursuitId: string) => void;
  onAddPursuit: () => void;
}

export function PursuitTabBar({
  pursuits,
  progress,
  selectedPursuitId,
  onSelectPursuit,
  onAddPursuit,
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
