"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Coffee,
  Brain,
  Users,
  Briefcase,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AgendaProposal,
  AgendaItem,
  RubricResult,
  AgendaCategory,
  WorkflowExecution,
} from "@/types/workflow";

// ============================================
// TYPES
// ============================================

export interface WorkflowState {
  type: 'planmyday' | string;
  status: 'running' | 'awaiting_user' | 'completed' | 'failed' | 'cancelled';
  step?: string;
  execution?: WorkflowExecution;
  proposal?: AgendaProposal;
  error?: string;
}

interface WorkflowMessageProps {
  state: WorkflowState;
  isLoading?: boolean;
  onApprove: () => Promise<void>;
  onReject: () => void;
}

// ============================================
// CATEGORY CONFIG
// ============================================

const categoryConfig: Record<AgendaCategory | 'OTHER', { icon: React.ReactNode; color: string; label: string }> = {
  META: { icon: <Briefcase className="h-3 w-3" />, color: "bg-blue-500", label: "Meta" },
  STARTUP: { icon: <Brain className="h-3 w-3" />, color: "bg-purple-500", label: "Startup" },
  HEDGE: { icon: <Briefcase className="h-3 w-3" />, color: "bg-indigo-500", label: "Hedge" },
  HEALTH: { icon: <Dumbbell className="h-3 w-3" />, color: "bg-green-500", label: "Health" },
  SOCIAL: { icon: <Users className="h-3 w-3" />, color: "bg-pink-500", label: "Social" },
  ADMIN: { icon: <Briefcase className="h-3 w-3" />, color: "bg-gray-500", label: "Admin" },
  RECOVERY: { icon: <Coffee className="h-3 w-3" />, color: "bg-amber-500", label: "Recovery" },
  MEETING: { icon: <Users className="h-3 w-3" />, color: "bg-cyan-500", label: "Meeting" },
  COMMUTE: { icon: <MapPin className="h-3 w-3" />, color: "bg-slate-500", label: "Commute" },
  LEARNING: { icon: <Brain className="h-3 w-3" />, color: "bg-violet-500", label: "Learning" },
  WRITING: { icon: <Briefcase className="h-3 w-3" />, color: "bg-rose-500", label: "Writing" },
  ERRANDS: { icon: <MapPin className="h-3 w-3" />, color: "bg-orange-500", label: "Errands" },
  OTHER: { icon: <Calendar className="h-3 w-3" />, color: "bg-gray-400", label: "Other" },
};

// ============================================
// HELPER COMPONENTS
// ============================================

function CompactAgendaItem({ item }: { item: AgendaItem }) {
  const config = categoryConfig[item.category || 'OTHER'];

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
      <span className="text-xs font-mono text-muted-foreground w-[70px]">
        {item.start_time}–{item.end_time}
      </span>
      <div className={cn("w-1.5 h-4 rounded-full shrink-0", config.color)} />
      <span className="text-sm truncate flex-1">{item.title}</span>
      {item.intensity && (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1 py-0",
            item.intensity === 'high' && "border-red-500 text-red-500",
            item.intensity === 'medium' && "border-yellow-500 text-yellow-500",
            item.intensity === 'low' && "border-green-500 text-green-500"
          )}
        >
          {item.intensity}
        </Badge>
      )}
    </div>
  );
}

function RubricSummary({ score, passed, failedCount }: { score: number; passed: boolean; failedCount: number }) {
  return (
    <div className="flex items-center gap-2">
      {passed ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : failedCount > 0 ? (
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={cn(
        "text-sm font-medium",
        score >= 80 ? "text-green-500" : score >= 60 ? "text-yellow-500" : "text-red-500"
      )}>
        {score}% score
      </span>
      {!passed && (
        <span className="text-xs text-muted-foreground">
          ({failedCount} issue{failedCount !== 1 ? 's' : ''})
        </span>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WorkflowMessage({
  state,
  isLoading = false,
  onApprove,
  onReject,
}: WorkflowMessageProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Running state
  if (state.status === 'running') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
        <div className="relative">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Generating your day plan...</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {state.step || 'Analyzing your calendar and goals'}
          </p>
        </div>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Failed state
  if (state.status === 'failed') {
    return (
      <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <XCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Failed to generate plan</span>
        </div>
        {state.error && (
          <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
            {state.error}
          </p>
        )}
      </div>
    );
  }

  // Cancelled state
  if (state.status === 'cancelled') {
    return (
      <div className="p-4 rounded-lg border bg-muted/50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <XCircle className="h-4 w-4" />
          <span className="text-sm">Plan cancelled</span>
        </div>
      </div>
    );
  }

  // Completed state
  if (state.status === 'completed') {
    return (
      <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">Plan saved to your calendar!</span>
        </div>
        <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
          {state.proposal?.items.length || 0} activities scheduled for {state.proposal?.date}
        </p>
      </div>
    );
  }

  // Awaiting user (proposal) state
  if (state.status === 'awaiting_user' && state.proposal) {
    const proposal = state.proposal;
    const failedCount = proposal.rubric_details?.results?.filter(r => !r.passed).length || 0;

    const handleApprove = async () => {
      setIsSubmitting(true);
      try {
        await onApprove();
      } finally {
        setIsSubmitting(false);
      }
    };

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    };

    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Day Plan</span>
            <Badge variant="outline" className="text-xs">
              {formatDate(proposal.date)}
            </Badge>
          </div>
          <RubricSummary
            score={proposal.rubric_score}
            passed={proposal.rubric_details?.passed ?? true}
            failedCount={failedCount}
          />
        </div>

        {/* Summary */}
        {proposal.summary && (
          <div className="px-3 py-2 border-b text-sm text-muted-foreground">
            {proposal.summary}
          </div>
        )}

        {/* Suggestions */}
        {proposal.suggestions && proposal.suggestions.length > 0 && (
          <div className="px-3 py-2 border-b bg-yellow-50/50 dark:bg-yellow-950/20">
            <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400 text-xs mb-1">
              <AlertTriangle className="h-3 w-3" />
              <span className="font-medium">Suggestions</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {proposal.suggestions.slice(0, 2).map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-yellow-500">•</span>
                  {s}
                </li>
              ))}
              {proposal.suggestions.length > 2 && (
                <li className="text-yellow-600 dark:text-yellow-400">
                  +{proposal.suggestions.length - 2} more
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Agenda Items - Compact View */}
        <div className="p-2 space-y-1 max-h-[280px] overflow-y-auto">
          {proposal.items.slice(0, expanded ? undefined : 5).map((item, idx) => (
            <CompactAgendaItem key={item.id || idx} item={item} />
          ))}
          {proposal.items.length > 5 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
            >
              <ChevronDown className="h-3 w-3" />
              Show {proposal.items.length - 5} more activities
            </button>
          )}
          {expanded && proposal.items.length > 5 && (
            <button
              onClick={() => setExpanded(false)}
              className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
            >
              <ChevronUp className="h-3 w-3" />
              Show less
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="p-2 border-t flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isSubmitting || isLoading}
            className="flex-1"
          >
            {isSubmitting ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReject}
            disabled={isSubmitting || isLoading}
          >
            <XCircle className="h-3 w-3" />
          </Button>
        </div>
        <div className="px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          Type in chat to request changes
        </div>
      </div>
    );
  }

  // Fallback for unknown state
  return (
    <div className="p-4 rounded-lg border bg-muted/50">
      <p className="text-sm text-muted-foreground">Unknown workflow state</p>
    </div>
  );
}

export default WorkflowMessage;
