"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  Calendar as CalendarIcon,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AgendaProposalView } from "./agenda-proposal";
import type { AgendaProposal, WorkflowExecution } from "@/types/workflow";

// ============================================
// COMPONENT
// ============================================

export function PlanMyDay() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [proposal, setProposal] = useState<AgendaProposal | null>(null);

  // Execute the planmyday workflow
  const handlePlanMyDay = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_slug: "planmyday",
          target_date: format(selectedDate, "yyyy-MM-dd"),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute workflow");
      }

      setExecution(data.execution);
      setProposal(data.proposal);
    } catch (err) {
      console.error("Error executing planmyday:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  // Approve the proposal
  const handleApprove = useCallback(async () => {
    if (!execution) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workflows/executions/${execution.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          feedback: "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve");
      }

      setExecution(data.execution);
      // Show success state
      if (data.execution.status === "completed") {
        setProposal(null);
        setExecution(null);
        // Could show a toast here
      }
    } catch (err) {
      console.error("Error approving:", err);
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setIsLoading(false);
    }
  }, [execution]);

  // Reject the proposal
  const handleReject = useCallback(() => {
    setExecution(null);
    setProposal(null);
  }, []);

  // Request changes with feedback
  const handleIterate = useCallback(async (feedback: string) => {
    if (!execution) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workflows/executions/${execution.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "iterate",
          feedback,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to iterate");
      }

      setExecution(data.execution);
      setProposal(data.proposal);
    } catch (err) {
      console.error("Error iterating:", err);
      setError(err instanceof Error ? err.message : "Failed to iterate");
    } finally {
      setIsLoading(false);
    }
  }, [execution]);

  // Show proposal if we have one
  if (proposal) {
    return (
      <div className="container max-w-3xl mx-auto py-6 px-4">
        {error && (
          <Card className="mb-4 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <CardContent className="pt-4 flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              {error}
            </CardContent>
          </Card>
        )}

        <AgendaProposalView
          proposal={proposal}
          isLoading={isLoading}
          onApprove={handleApprove}
          onReject={handleReject}
          onIterate={handleIterate}
        />
      </div>
    );
  }

  // Initial state - show date picker and start button
  return (
    <div className="container max-w-lg mx-auto py-12 px-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Plan My Day
          </CardTitle>
          <CardDescription>
            Generate an optimized agenda based on your calendar, goals, and health constraints
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Date Picker */}
          <div className="flex flex-col items-center gap-2">
            <label className="text-sm font-medium">Select Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handlePlanMyDay}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating your plan...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Day Plan
              </>
            )}
          </Button>

          {/* Info */}
          <p className="text-xs text-muted-foreground text-center">
            Your plan will be validated against your rubrics including sleep protection,
            caffeine cutoff, and morning sunlight requirements.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default PlanMyDay;
