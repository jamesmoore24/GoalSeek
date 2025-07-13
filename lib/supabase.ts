import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase environment variables:");
  console.error(
    "   NEXT_PUBLIC_SUPABASE_URL:",
    supabaseUrl ? "Set" : "Missing"
  );
  console.error(
    "   NEXT_PUBLIC_SUPABASE_ANON_KEY:",
    supabaseAnonKey ? "Set" : "Missing"
  );
  throw new Error("Missing Supabase environment variables");
}

console.log("🔗 Initializing Supabase client with URL:", supabaseUrl);
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types based on our schema
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          created_at: string;
          updated_at: string;
          preferences: UserPreferences;
          integrations: UserIntegrations;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          preferences?: UserPreferences;
          integrations?: UserIntegrations;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
          preferences?: UserPreferences;
          integrations?: UserIntegrations;
        };
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          progress: number;
          deadline: string | null;
          category: string;
          priority: string;
          type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          progress?: number;
          deadline?: string | null;
          category: string;
          priority: string;
          type: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          progress?: number;
          deadline?: string | null;
          category?: string;
          priority?: string;
          type?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          title: string;
          description: string | null;
          completed: boolean;
          priority: string;
          category: string;
          estimated_time: number | null;
          deadline: string | null;
          scheduled_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id?: string | null;
          title: string;
          description?: string | null;
          completed?: boolean;
          priority: string;
          category: string;
          estimated_time?: number | null;
          deadline?: string | null;
          scheduled_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string | null;
          title?: string;
          description?: string | null;
          completed?: boolean;
          priority?: string;
          category?: string;
          estimated_time?: number | null;
          deadline?: string | null;
          scheduled_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          role: string;
          content: string;
          metadata: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          role: string;
          content: string;
          metadata?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          role?: string;
          content?: string;
          metadata?: any;
          created_at?: string;
        };
      };
      day_analysis: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          overall_score: number;
          insights: string[];
          recommendations: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          overall_score: number;
          insights?: string[];
          recommendations?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          overall_score?: number;
          insights?: string[];
          recommendations?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      category_scores: {
        Row: {
          id: string;
          day_analysis_id: string;
          name: string;
          score: number;
          trend: string;
          tasks: number;
          completed: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          day_analysis_id: string;
          name: string;
          score: number;
          trend: string;
          tasks: number;
          completed: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          day_analysis_id?: string;
          name?: string;
          score?: number;
          trend?: string;
          tasks?: number;
          completed?: number;
          created_at?: string;
        };
      };
      time_blocks: {
        Row: {
          id: string;
          day_analysis_id: string;
          time: string;
          activity: string;
          score: number;
          category: string;
          completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          day_analysis_id: string;
          time: string;
          activity: string;
          score: number;
          category: string;
          completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          day_analysis_id?: string;
          time?: string;
          activity?: string;
          score?: number;
          category?: string;
          completed?: boolean;
          created_at?: string;
        };
      };
      whoop_data: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          recovery_score: number;
          sleep_score: number;
          strain_score: number;
          heart_rate_variability: number | null;
          resting_heart_rate: number | null;
          sleep_duration: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          recovery_score: number;
          sleep_score: number;
          strain_score: number;
          heart_rate_variability?: number | null;
          resting_heart_rate?: number | null;
          sleep_duration?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          recovery_score?: number;
          sleep_score?: number;
          strain_score?: number;
          heart_rate_variability?: number | null;
          resting_heart_rate?: number | null;
          sleep_duration?: number | null;
          created_at?: string;
        };
      };
      weather_data: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          temperature: number;
          humidity: number | null;
          conditions: string;
          location: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          temperature: number;
          humidity?: number | null;
          conditions: string;
          location: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          temperature?: number;
          humidity?: number | null;
          conditions?: string;
          location?: string;
          created_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string;
          category: string;
          metadata: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content: string;
          category: string;
          metadata?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string;
          category?: string;
          metadata?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export interface UserPreferences {
  working_hours?: {
    start: string;
    end: string;
  };
  peak_energy_times?: string[];
  preferred_workout_times?: string[];
  sleep_schedule?: {
    bedtime: string;
    wakeup: string;
  };
}

export interface UserIntegrations {
  whoop_enabled?: boolean;
  google_calendar_enabled?: boolean;
  google_tasks_enabled?: boolean;
  weather_enabled?: boolean;
  whoop_token?: string;
  google_access_token?: string;
  google_refresh_token?: string;
}
