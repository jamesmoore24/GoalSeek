export interface Goal {
  id: string
  title: string
  description: string
  progress: number
  deadline: string
  category: "Learning" | "Fitness" | "Career" | "Finance" | "Relationships" | "Health"
  priority: "High" | "Medium" | "Low"
  type: "short-term" | "long-term"
  tasks?: Task[]
  milestones?: Milestone[]
}

export interface Task {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: "High" | "Medium" | "Low"
  category: string
  estimatedTime?: number
  deadline?: string
  goalId?: string
}

export interface Milestone {
  title: string
  progress: number
  completed: boolean
  deadline?: string
}

export interface DayAnalysis {
  date: string
  overallScore: number
  categories: CategoryScore[]
  insights: string[]
  timeBlocks: TimeBlock[]
  recommendations: string[]
}

export interface CategoryScore {
  name: string
  score: number
  trend: "up" | "down" | "stable"
  tasks: number
  completed: number
}

export interface TimeBlock {
  time: string
  activity: string
  score: number
  category: string
  completed?: boolean
}

export interface UserProfile {
  id: string
  name: string
  preferences: {
    workingHours: { start: string; end: string }
    peakEnergyTimes: string[]
    preferredWorkoutTimes: string[]
    sleepSchedule: { bedtime: string; wakeup: string }
  }
  integrations: {
    whoop: boolean
    googleCalendar: boolean
    googleTasks: boolean
    weather: boolean
  }
}

export interface AgentResponse {
  type: "suggestion" | "analysis" | "recommendation" | "insight"
  content: string
  actions?: string[]
  data?: any
}

// Re-export workflow types
export * from './workflow'
