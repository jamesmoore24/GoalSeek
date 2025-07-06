"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Clock, Target, Activity } from "lucide-react"

const mockDayData = {
  date: new Date().toLocaleDateString(),
  overallScore: 8.5,
  categories: [
    { name: "Productivity", score: 9.2, trend: "up", tasks: 12, completed: 11 },
    { name: "Health & Fitness", score: 7.8, trend: "up", tasks: 4, completed: 3 },
    { name: "Learning", score: 8.0, trend: "down", tasks: 3, completed: 2 },
    { name: "Relationships", score: 6.5, trend: "up", tasks: 2, completed: 1 },
  ],
  insights: [
    "Great productivity day! You completed 91% of your planned tasks.",
    "Your workout consistency is improving - 7 day streak!",
    "Consider scheduling more time for relationship building.",
    "Energy levels were highest between 9-11 AM based on task completion.",
  ],
  timeBlocks: [
    { time: "6:00-8:00", activity: "Morning Routine", score: 9, category: "Health" },
    { time: "8:00-12:00", activity: "Deep Work", score: 9.5, category: "Productivity" },
    { time: "12:00-13:00", activity: "Lunch & Break", score: 8, category: "Health" },
    { time: "13:00-17:00", activity: "Meetings & Tasks", score: 7.5, category: "Productivity" },
    { time: "17:00-18:00", activity: "Workout", score: 8.5, category: "Health" },
    { time: "18:00-20:00", activity: "Personal Time", score: 7, category: "Relationships" },
  ],
}

export default function DayAnalysis() {
  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Today's Performance</span>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {mockDayData.overallScore}/10
            </Badge>
          </CardTitle>
          <CardDescription>{mockDayData.date}</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={mockDayData.overallScore * 10} className="h-3" />
          <p className="text-sm text-gray-600 mt-2">Excellent day! You're performing above your average.</p>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Category Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockDayData.categories.map((category, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Target className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-gray-600">
                      {category.completed}/{category.tasks} tasks completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold">{category.score}</span>
                  {category.trend === "up" ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Time Block Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Time Block Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockDayData.timeBlocks.map((block, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="text-sm font-mono text-gray-600 w-20">{block.time}</div>
                  <div>
                    <p className="font-medium">{block.activity}</p>
                    <Badge variant="outline" className="text-xs">
                      {block.category}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${block.score * 10}%` }}></div>
                  </div>
                  <span className="text-sm font-medium w-8">{block.score}</span>
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
            <Activity className="h-5 w-5" />
            <span>AI Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockDayData.insights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm text-gray-700">{insight}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
