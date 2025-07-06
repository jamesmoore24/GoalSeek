"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Target, Activity, Brain, Heart, TrendingUp, Clock, Zap } from "lucide-react"

const quickActions = [
  {
    title: "Plan Next Task",
    description: "Get AI recommendation for your next optimal task",
    icon: Target,
    color: "bg-blue-100 text-blue-600",
    action: "suggest-next-task",
  },
  {
    title: "Log Workout",
    description: "Record your latest fitness activity",
    icon: Activity,
    color: "bg-green-100 text-green-600",
    action: "log-workout",
  },
  {
    title: "Mood Check-in",
    description: "Track your current energy and mood",
    icon: Heart,
    color: "bg-red-100 text-red-600",
    action: "mood-checkin",
  },
  {
    title: "Learning Session",
    description: "Start a focused learning block",
    icon: Brain,
    color: "bg-purple-100 text-purple-600",
    action: "start-learning",
  },
]

const upcomingTasks = [
  {
    title: "Review React components",
    time: "2:00 PM",
    priority: "High",
    category: "Learning",
  },
  {
    title: "Team standup meeting",
    time: "3:30 PM",
    priority: "Medium",
    category: "Work",
  },
  {
    title: "Gym workout",
    time: "6:00 PM",
    priority: "High",
    category: "Fitness",
  },
]

const insights = [
  {
    title: "Peak Performance Time",
    description: "You're most productive between 9-11 AM",
    icon: Clock,
    trend: "up",
  },
  {
    title: "Consistency Streak",
    description: "7 days of completing morning routine",
    icon: Zap,
    trend: "up",
  },
  {
    title: "Goal Momentum",
    description: "73% progress on monthly objectives",
    icon: TrendingUp,
    trend: "up",
  },
]

export default function QuickActions() {
  const handleQuickAction = (action: string) => {
    console.log(`Executing action: ${action}`)
    // This would integrate with your agent system
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and check-ins</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto p-3 flex flex-col items-center space-y-2 bg-transparent"
                  onClick={() => handleQuickAction(action.action)}
                >
                  <div className={`p-2 rounded-full ${action.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium">{action.title}</p>
                  </div>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Upcoming</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingTasks.map((task, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-gray-600">{task.time}</p>
                </div>
                <div className="flex space-x-1">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      task.priority === "High"
                        ? "border-red-200 text-red-700"
                        : task.priority === "Medium"
                          ? "border-yellow-200 text-yellow-700"
                          : "border-green-200 text-green-700"
                    }`}
                  >
                    {task.priority}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>AI Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.map((insight, index) => {
              const Icon = insight.icon
              return (
                <div key={index} className="flex items-start space-x-3 p-2">
                  <div className="flex-shrink-0 p-1 bg-blue-100 rounded-full">
                    <Icon className="h-3 w-3 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{insight.title}</p>
                    <p className="text-xs text-gray-600">{insight.description}</p>
                  </div>
                  <TrendingUp className="h-3 w-3 text-green-600" />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
