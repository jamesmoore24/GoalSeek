"use client";

import { useState } from "react";
import type { Subgoal, Milestone } from "@/types/pursuit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, CheckCircle2, Circle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SubgoalListProps {
  pursuitId: string;
  subgoals: Subgoal[];
  onUpdate: () => void;
}

export function SubgoalList({ pursuitId, subgoals, onUpdate }: SubgoalListProps) {
  const [expandedSubgoals, setExpandedSubgoals] = useState<Set<string>>(new Set());

  const toggleSubgoal = (id: string) => {
    setExpandedSubgoals(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleMilestone = async (subgoal: Subgoal, milestoneIndex: number) => {
    const updatedMilestones = [...subgoal.intermediate_milestones];
    updatedMilestones[milestoneIndex] = {
      ...updatedMilestones[milestoneIndex],
      completed: !updatedMilestones[milestoneIndex].completed,
      completed_at: !updatedMilestones[milestoneIndex].completed
        ? new Date().toISOString()
        : null,
    };

    try {
      const response = await fetch(`/api/subgoals/${subgoal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intermediate_milestones: updatedMilestones,
        }),
      });

      if (!response.ok) throw new Error("Failed to update milestone");

      toast.success("Milestone updated");
      onUpdate();
    } catch (error) {
      console.error("Failed to update milestone:", error);
      toast.error("Failed to update milestone");
    }
  };

  const getMilestoneProgress = (milestones: Milestone[]) => {
    if (milestones.length === 0) return 0;
    const completed = milestones.filter(m => m.completed).length;
    return (completed / milestones.length) * 100;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'paused': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

  if (subgoals.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>No subgoals yet.</p>
          <p className="text-sm mt-2">
            Use the <strong>Chat</strong> tab to create SMART subgoals with execution strategies.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {subgoals.map((subgoal) => {
        const isExpanded = expandedSubgoals.has(subgoal.id);
        const milestoneProgress = getMilestoneProgress(subgoal.intermediate_milestones);
        const hasSmartCriteria = Object.values(subgoal.smart_criteria).some(v => v);

        return (
          <Card key={subgoal.id} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted"
              onClick={() => toggleSubgoal(subgoal.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <CardTitle className="text-base">{subgoal.name}</CardTitle>
                    <Badge variant={getStatusColor(subgoal.status) as any}>
                      {subgoal.status}
                    </Badge>
                  </div>

                  {subgoal.intermediate_milestones.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {subgoal.intermediate_milestones.filter(m => m.completed).length} /{" "}
                          {subgoal.intermediate_milestones.length} milestones
                        </span>
                        <span>{milestoneProgress.toFixed(0)}%</span>
                      </div>
                      <Progress value={milestoneProgress} className="h-2" />
                    </div>
                  )}

                  {subgoal.deadline && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <Calendar className="h-3 w-3" />
                      <span>Due {new Date(subgoal.deadline).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform shrink-0 text-muted-foreground",
                    isExpanded && "transform rotate-180"
                  )}
                />
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-4 border-t">
                {subgoal.description && (
                  <p className="text-sm text-muted-foreground">{subgoal.description}</p>
                )}

                {/* SMART Criteria */}
                {hasSmartCriteria && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">SMART Criteria</h4>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      {subgoal.smart_criteria.specific && (
                        <div className="bg-muted/50 p-2 rounded">
                          <span className="font-medium text-muted-foreground">Specific:</span>{" "}
                          {subgoal.smart_criteria.specific}
                        </div>
                      )}
                      {subgoal.smart_criteria.measurable && (
                        <div className="bg-muted/50 p-2 rounded">
                          <span className="font-medium text-muted-foreground">Measurable:</span>{" "}
                          {subgoal.smart_criteria.measurable}
                        </div>
                      )}
                      {subgoal.smart_criteria.achievable && (
                        <div className="bg-muted/50 p-2 rounded">
                          <span className="font-medium text-muted-foreground">Achievable:</span>{" "}
                          {subgoal.smart_criteria.achievable}
                        </div>
                      )}
                      {subgoal.smart_criteria.relevant && (
                        <div className="bg-muted/50 p-2 rounded">
                          <span className="font-medium text-muted-foreground">Relevant:</span>{" "}
                          {subgoal.smart_criteria.relevant}
                        </div>
                      )}
                      {subgoal.smart_criteria.timebound && (
                        <div className="bg-muted/50 p-2 rounded">
                          <span className="font-medium text-muted-foreground">Timebound:</span>{" "}
                          {subgoal.smart_criteria.timebound}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Execution Strategy */}
                {subgoal.execution_strategy && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Execution Strategy</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded">
                      {subgoal.execution_strategy}
                    </p>
                  </div>
                )}

                {/* Daily/Session Deliverables */}
                {(subgoal.daily_deliverable || subgoal.session_deliverable) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {subgoal.daily_deliverable && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Daily Goal</h4>
                        <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                          {subgoal.daily_deliverable}
                        </p>
                      </div>
                    )}
                    {subgoal.session_deliverable && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Per Session</h4>
                        <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                          {subgoal.session_deliverable}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Milestones */}
                {subgoal.intermediate_milestones.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Milestones</h4>
                    <div className="space-y-1">
                      {subgoal.intermediate_milestones.map((milestone, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMilestone(subgoal, idx);
                          }}
                          className="flex items-start gap-2 w-full text-left hover:bg-muted/50 p-2 rounded transition-colors active:bg-muted"
                        >
                          {milestone.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <span
                            className={cn(
                              "text-sm",
                              milestone.completed && "line-through text-muted-foreground"
                            )}
                          >
                            {milestone.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
