"use client";

import { useState, useEffect, useRef } from "react";
import type { Pursuit, PursuitProgress } from "@/types/pursuit";
import { PursuitTabBar } from "@/app/components/pursuit/pursuit-tab-bar";
import { UnifiedChat, UnifiedChatRef } from "@/app/components/pursuit/unified-chat";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Home() {
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);
  const [progress, setProgress] = useState<Map<string, PursuitProgress>>(new Map());
  const [selectedPursuitId, setSelectedPursuitId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const chatRef = useRef<UnifiedChatRef>(null);

  // New pursuit form
  const [newPursuit, setNewPursuit] = useState({
    name: "",
    description: "",
    weekly_hours_target: 10,
    color: "#3b82f6",
  });

  useEffect(() => {
    fetchPursuits();
  }, []);

  useEffect(() => {
    if (pursuits.length > 0 && !selectedPursuitId) {
      setSelectedPursuitId(pursuits[0].id);
    }
  }, [pursuits, selectedPursuitId]);

  const fetchPursuits = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/pursuits?status=active");
      if (!response.ok) throw new Error("Failed to fetch pursuits");

      const data = await response.json();
      const pursuitsData: Pursuit[] = data.pursuits || [];
      setPursuits(pursuitsData);

      // Fetch progress for each pursuit
      const progressMap = new Map<string, PursuitProgress>();
      await Promise.all(
        pursuitsData.map(async (pursuit) => {
          try {
            const progressRes = await fetch(`/api/pursuits/${pursuit.id}/progress`);
            if (progressRes.ok) {
              const { progress: pursuitProgress } = await progressRes.json();
              progressMap.set(pursuit.id, pursuitProgress);
            }
          } catch (error) {
            console.error(`Failed to fetch progress for ${pursuit.id}:`, error);
          }
        })
      );
      setProgress(progressMap);
    } catch (error) {
      console.error("Failed to fetch pursuits:", error);
      toast.error("Failed to load pursuits");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePursuit = async () => {
    if (!newPursuit.name.trim()) {
      toast.error("Please enter a pursuit name");
      return;
    }

    try {
      const response = await fetch("/api/pursuits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPursuit),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create pursuit");
      }

      const { pursuit } = await response.json();
      toast.success(`Created pursuit: ${pursuit.name}`);

      setNewPursuit({
        name: "",
        description: "",
        weekly_hours_target: 10,
        color: "#3b82f6",
      });
      setShowCreateDialog(false);

      fetchPursuits();
      setSelectedPursuitId(pursuit.id);
    } catch (error: any) {
      console.error("Failed to create pursuit:", error);
      toast.error(error.message || "Failed to create pursuit");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <PursuitTabBar
        pursuits={pursuits}
        progress={progress}
        selectedPursuitId={selectedPursuitId}
        onSelectPursuit={setSelectedPursuitId}
        onAddPursuit={() => setShowCreateDialog(true)}
        onRunWorkflow={(slug) => chatRef.current?.runWorkflow(slug)}
      />

      <div className="flex-1 overflow-hidden">
        <UnifiedChat
          ref={chatRef}
          selectedPursuitId={selectedPursuitId}
          pursuits={pursuits}
          progress={progress}
          onDataChange={fetchPursuits}
        />
      </div>

      <CreatePursuitDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        newPursuit={newPursuit}
        setNewPursuit={setNewPursuit}
        onCreate={handleCreatePursuit}
      />
    </div>
  );
}

// Create Pursuit Dialog Component
function CreatePursuitDialog({
  open,
  onOpenChange,
  newPursuit,
  setNewPursuit,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newPursuit: any;
  setNewPursuit: (pursuit: any) => void;
  onCreate: () => void;
}) {
  const colorOptions = [
    { name: "Blue", value: "#3b82f6" },
    { name: "Green", value: "#10b981" },
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f59e0b" },
    { name: "Purple", value: "#8b5cf6" },
    { name: "Pink", value: "#ec4899" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Pursuit</DialogTitle>
          <DialogDescription>
            Define a new goal or area of focus to track and manage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Pursuit Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Meta, Startup, Health & Fitness"
              value={newPursuit.name}
              onChange={(e) => setNewPursuit({ ...newPursuit, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What is this pursuit about?"
              value={newPursuit.description}
              onChange={(e) => setNewPursuit({ ...newPursuit, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Weekly Hours Target</Label>
            <Input
              id="hours"
              type="number"
              min="0"
              max="168"
              value={newPursuit.weekly_hours_target}
              onChange={(e) =>
                setNewPursuit({ ...newPursuit, weekly_hours_target: parseInt(e.target.value) || 0 })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setNewPursuit({ ...newPursuit, color: color.value })}
                  className={`w-10 h-10 rounded-full transition-all ${
                    newPursuit.color === color.value
                      ? "ring-2 ring-offset-2 ring-foreground scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreate}>Create Pursuit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
