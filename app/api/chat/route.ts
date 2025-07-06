import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"

// Mock data that would come from your integrations
const mockUserData = {
  goals: {
    shortTerm: [
      { title: "Complete React Course", progress: 75, deadline: "2024-01-31" },
      { title: "Run 5K Under 25 Minutes", progress: 60, deadline: "2024-02-15" },
    ],
    longTerm: [
      { title: "Launch Personal AI Assistant", progress: 30, deadline: "2024-06-30" },
      { title: "Achieve Financial Independence", progress: 45, deadline: "2026-12-31" },
    ],
  },
  todaysTasks: [
    { title: "Review React components", completed: false, priority: "High", time: "2:00 PM" },
    { title: "Team standup meeting", completed: false, priority: "Medium", time: "3:30 PM" },
    { title: "Gym workout", completed: false, priority: "High", time: "6:00 PM" },
  ],
  recentActivity: {
    workoutStreak: 7,
    tasksCompletedToday: 8,
    totalTasksToday: 12,
    energyLevel: 8.5,
    currentTime: new Date().toLocaleTimeString(),
  },
  calendar: [
    { title: "Deep Work Block", time: "9:00-11:00 AM", completed: true },
    { title: "Lunch Break", time: "12:00-1:00 PM", completed: true },
    { title: "Project Review", time: "2:00-3:00 PM", completed: false },
  ],
}

const systemPrompt = `You are a personal AI assistant designed to help users achieve their goals and optimize their daily performance. You have access to the user's:

- Goals (short-term and long-term with progress tracking)
- Today's tasks and schedule
- Recent activity and performance metrics
- Calendar events
- Fitness and health data

Current user data:
${JSON.stringify(mockUserData, null, 2)}

Your role is to:
1. Provide actionable recommendations based on current progress and schedule
2. Help prioritize tasks based on goals, deadlines, and energy levels
3. Offer insights about productivity patterns and performance
4. Suggest optimizations for daily routines
5. Provide motivation and accountability

Key capabilities:
- Analyze day performance and suggest improvements
- Recommend next optimal tasks based on context
- Track goal progress and suggest adjustments
- Provide time management and productivity insights
- Offer personalized advice based on patterns

Always be:
- Specific and actionable in recommendations
- Data-driven in your analysis
- Encouraging but realistic
- Focused on helping achieve stated goals
- Aware of time constraints and energy levels

Current time: ${new Date().toLocaleString()}
`

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = await streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages,
    temperature: 0.7,
    maxTokens: 1000,
  })

  return result.toDataStreamResponse()
}
