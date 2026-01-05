"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Coffee,
  Sun,
  Moon,
  Brain,
  Users,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AgendaProposal,
  AgendaItem,
  RubricResult,
  AgendaCategory,
} from "@/types/workflow";

// ============================================
// COMPONENT PROPS
// ============================================

interface AgendaProposalViewProps {
  proposal: AgendaProposal;
  isLoading?: boolean;
  onApprove: () => Promise<void>;
  onReject: () => void;
  onIterate: (feedback: string) => Promise<void>;
}

// ============================================
// HELPER COMPONENTS
// ============================================

// Category icons and colors
const categoryConfig: Record<AgendaCategory | 'OTHER', { icon: React.ReactNode; color: string; label: string }> = {
  META: { icon: <Briefcase className="h-4 w-4" />, color: "bg-blue-500", label: "Meta Work" },
  STARTUP: { icon: <Brain className="h-4 w-4" />, color: "bg-purple-500", label: "Startup" },
  HEDGE: { icon: <Briefcase className="h-4 w-4" />, color: "bg-indigo-500", label: "Hedge Fund" },
  HEALTH: { icon: <Dumbbell className="h-4 w-4" />, color: "bg-green-500", label: "Health" },
  SOCIAL: { icon: <Users className="h-4 w-4" />, color: "bg-pink-500", label: "Social" },
  ADMIN: { icon: <Briefcase className="h-4 w-4" />, color: "bg-gray-500", label: "Admin" },
  RECOVERY: { icon: <Coffee className="h-4 w-4" />, color: "bg-amber-500", label: "Recovery" },
  MEETING: { icon: <Users className="h-4 w-4" />, color: "bg-cyan-500", label: "Meeting" },
  COMMUTE: { icon: <MapPin className="h-4 w-4" />, color: "bg-slate-500", label: "Commute" },
  LEARNING: { icon: <Brain className="h-4 w-4" />, color: "bg-violet-500", label: "Learning" },
  WRITING: { icon: <Briefcase className="h-4 w-4" />, color: "bg-rose-500", label: "Writing" },
  ERRANDS: { icon: <MapPin className="h-4 w-4" />, color: "bg-orange-500", label: "Errands" },
  OTHER: { icon: <Calendar className="h-4 w-4" />, color: "bg-gray-400", label: "Other" },
};

function AgendaItemCard({ item, index }: { item: AgendaItem; index: number }) {
  const config = categoryConfig[item.category || 'OTHER'];
  const duration = calculateDuration(item.start_time, item.end_time);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      {/* Time column */}
      <div className="flex flex-col items-center min-w-[60px]">
        <span className="text-sm font-medium">{item.start_time}</span>
        <div className="h-4 w-px bg-border my-1" />
        <span className="text-xs text-muted-foreground">{item.end_time}</span>
      </div>

      {/* Category indicator */}
      <div className={cn("w-1 h-full min-h-[60px] rounded-full", config.color)} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{item.title}</h4>
          {item.intensity && (
            <Badge variant={item.intensity === 'high' ? 'destructive' : item.intensity === 'medium' ? 'default' : 'secondary'} className="text-xs">
              {item.intensity}
            </Badge>
          )}
        </div>

        {item.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {item.description}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {duration}
          </span>
          {item.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {item.location}
            </span>
          )}
          <Badge variant="outline" className="text-xs">
            {config.icon}
            <span className="ml-1">{config.label}</span>
          </Badge>
        </div>
      </div>
    </div>
  );
}

function RubricScoreCard({ results, score, passed }: { results: RubricResult[]; score: number; passed: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const hardConstraints = results.filter(r => r.constraint_type === 'hard');
  const softConstraints = results.filter(r => r.constraint_type === 'soft');
  const failedHard = hardConstraints.filter(r => !r.passed);
  const failedSoft = softConstraints.filter(r => !r.passed);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {passed ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : failedHard.length > 0 ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            Rubric Score
          </CardTitle>
          <span className={cn(
            "text-2xl font-bold",
            score >= 80 ? "text-green-500" : score >= 60 ? "text-yellow-500" : "text-red-500"
          )}>
            {score}%
          </span>
        </div>
        <CardDescription>
          {passed
            ? "All constraints satisfied"
            : failedHard.length > 0
            ? `${failedHard.length} hard constraint(s) failed`
            : `${failedSoft.length} soft constraint(s) need attention`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={score} className="h-2 mb-4" />

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          onClick={() => setExpanded(!expanded)}
        >
          <span>View details ({results.length} constraints)</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {expanded && (
          <div className="mt-4 space-y-2">
            {/* Hard constraints */}
            {hardConstraints.length > 0 && (
              <div>
                <h5 className="text-sm font-medium mb-2">Hard Constraints</h5>
                {hardConstraints.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm py-1">
                    {r.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                    )}
                    <div>
                      <span className={cn(!r.passed && "text-red-600 dark:text-red-400")}>{r.name}</span>
                      {r.message && (
                        <p className="text-xs text-muted-foreground">{r.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Soft constraints */}
            {softConstraints.length > 0 && (
              <div>
                <h5 className="text-sm font-medium mb-2 mt-3">Soft Constraints</h5>
                {softConstraints.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm py-1">
                    {r.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={cn(!r.passed && "text-yellow-600 dark:text-yellow-400")}>{r.name}</span>
                        <span className="text-xs text-muted-foreground">{r.score}%</span>
                      </div>
                      {r.message && (
                        <p className="text-xs text-muted-foreground">{r.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AgendaProposalView({
  proposal,
  isLoading = false,
  onApprove,
  onReject,
  onIterate,
}: AgendaProposalViewProps) {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIterate = async () => {
    if (!feedback.trim()) return;
    setIsSubmitting(true);
    try {
      await onIterate(feedback);
      setFeedback("");
      setShowFeedbackDialog(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Your Day Plan
          </h2>
          <p className="text-muted-foreground">{formatDate(proposal.date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-yellow-500" />
          <span className="text-sm text-muted-foreground">
            {proposal.items.length} activities
          </span>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm">{proposal.summary}</p>
        </CardContent>
      </Card>

      {/* Rubric Score */}
      <RubricScoreCard
        results={proposal.rubric_details.results}
        score={proposal.rubric_score}
        passed={proposal.rubric_details.passed}
      />

      {/* Suggestions */}
      {proposal.suggestions && proposal.suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {proposal.suggestions.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Agenda Items */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Schedule</h3>
        {proposal.items.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No activities planned</p>
        ) : (
          proposal.items.map((item, index) => (
            <AgendaItemCard key={item.id || index} item={item} index={index} />
          ))
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button
          onClick={handleApprove}
          disabled={isSubmitting || isLoading}
          className="flex-1"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Approve & Sync to Calendar
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowFeedbackDialog(true)}
          disabled={isSubmitting || isLoading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Request Changes
        </Button>

        <Button
          variant="ghost"
          onClick={onReject}
          disabled={isSubmitting || isLoading}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Tell us what you'd like to change about this plan. Be specific about timing, activities, or constraints.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="E.g., 'Move the workout to afternoon', 'Add time for lunch with a friend', 'I need more deep work time in the morning'"
            className="min-h-[120px]"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleIterate} disabled={!feedback.trim() || isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateDuration(start: string, end: string): string {
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const duration = endMinutes - startMinutes;

  if (duration < 60) {
    return `${duration}m`;
  }

  const hours = Math.floor(duration / 60);
  const mins = duration % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

// Export default
export default AgendaProposalView;
