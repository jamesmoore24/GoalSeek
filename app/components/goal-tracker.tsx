"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Target, Calendar, TrendingUp, Plus, CheckCircle } from "lucide-react"

const mockGoals = {
  shortTerm: [
    {
      id: 1,
      title: "Complete React Course",
      description: "Finish the advanced React course by end of month",
      progress: 75,
      deadline: "2024-01-31",
      category: "Learning",
      priority: "High",
      tasks: [
        { id: 1, title: "Complete Hooks section", completed: true },
        { id: 2, title: "Build portfolio project", completed: true },
        { id: 3, title: "Take final assessment", completed: false },
      ],
    },
    {
      id: 2,
      title: "Run 5K Under 25 Minutes",
      description: "Improve running time for upcoming race",
      progress: 60,
      deadline: "2024-02-15",
      category: "Fitness",
      priority: "Medium",
      tasks: [
        { id: 4, title: "Run 3x per week", completed: true },
        { id: 5, title: "Complete interval training", completed: false },
        { id: 6, title: "Track pace improvements", completed: true },
      ],
    },
  ],
  longTerm: [
    {
      id: 3,
      title: "Launch Personal AI Assistant",
      description: "Build and deploy a comprehensive personal AI system",
      progress: 30,
      deadline: "2024-06-30",
      category: "Career",
      priority: "High",
      milestones: [
        { title: "Complete MVP", progress: 80, completed: false },
        { title: "User Testing", progress: 0, completed: false },
        { title: "Production Deployment", progress: 0, completed: false },
      ],
    },
    {
      id: 4,
      title: "Achieve Financial Independence",
      description: "Build emergency fund and investment portfolio",
      progress: 45,
      deadline: "2026-12-31",
      category: "Finance",
      priority: "High",
      milestones: [
        { title: "6-month emergency fund", progress: 90, completed: false },
        { title: "Max out 401k", progress: 60, completed: false },
        { title: "Diversified portfolio", progress: 30, completed: false },
      ],
    },
  ],
}

export default function GoalTracker() {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-800"
      case "Medium":
        return "bg-yellow-100 text-yellow-800"
      case "Low":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Learning":
        return "bg-blue-100 text-blue-800"
      case "Fitness":
        return "bg-green-100 text-green-800"
      case "Career":
        return "bg-purple-100 text-purple-800"
      case "Finance":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-6">
      {/* Short-term Goals */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-blue-600" />
                <span>Short-term Goals</span>
              </CardTitle>
              <CardDescription>Goals for the next 1-3 months</CardDescription>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockGoals.shortTerm.map((goal) => (
              <div key={goal.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{goal.title}</h3>
                    <p className="text-gray-600 text-sm">{goal.description}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Badge className={getPriorityColor(goal.priority)}>{goal.priority}</Badge>
                    <Badge className={getCategoryColor(goal.category)}>{goal.category}</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress</span>
                    <span className="font-medium">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Due: {new Date(goal.deadline).toLocaleDateString()}</span>
                  </div>
                  <span>
                    {goal.tasks?.filter((t) => t.completed).length || 0}/{goal.tasks?.length || 0} tasks completed
                  </span>
                </div>

                {goal.tasks && (
                  <div className="space-y-1 pt-2 border-t">
                    {goal.tasks.map((task) => (
                      <div key={task.id} className="flex items-center space-x-2 text-sm">
                        <CheckCircle className={`h-4 w-4 ${task.completed ? "text-green-600" : "text-gray-400"}`} />
                        <span className={task.completed ? "line-through text-gray-500" : ""}>{task.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Long-term Goals */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <span>Long-term Goals</span>
              </CardTitle>
              <CardDescription>Goals for the next 6 months to 2+ years</CardDescription>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockGoals.longTerm.map((goal) => (
              <div key={goal.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{goal.title}</h3>
                    <p className="text-gray-600 text-sm">{goal.description}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Badge className={getPriorityColor(goal.priority)}>{goal.priority}</Badge>
                    <Badge className={getCategoryColor(goal.category)}>{goal.category}</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Overall Progress</span>
                    <span className="font-medium">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Target: {new Date(goal.deadline).toLocaleDateString()}</span>
                  </div>
                </div>

                {goal.milestones && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-sm font-medium text-gray-700">Milestones:</p>
                    {goal.milestones.map((milestone, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{milestone.title}</span>
                          <span className="font-medium">{milestone.progress}%</span>
                        </div>
                        <Progress value={milestone.progress} className="h-1" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
