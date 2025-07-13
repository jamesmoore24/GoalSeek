-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  preferences JSONB DEFAULT '{}',
  integrations JSONB DEFAULT '{}'
);

-- Create goals table
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  deadline DATE,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
  type TEXT NOT NULL CHECK (type IN ('short-term', 'long-term')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
  category TEXT NOT NULL,
  estimated_time INTEGER, -- in minutes
  deadline TIMESTAMP WITH TIME ZONE,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_sessions table
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create day_analysis table
CREATE TABLE day_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  overall_score DECIMAL(3,1) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 10),
  insights TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create category_scores table
CREATE TABLE category_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_analysis_id UUID REFERENCES day_analysis(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  score DECIMAL(3,1) NOT NULL CHECK (score >= 0 AND score <= 10),
  trend TEXT NOT NULL CHECK (trend IN ('up', 'down', 'stable')),
  tasks INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create time_blocks table
CREATE TABLE time_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_analysis_id UUID REFERENCES day_analysis(id) ON DELETE CASCADE,
  time TEXT NOT NULL,
  activity TEXT NOT NULL,
  score DECIMAL(3,1) NOT NULL CHECK (score >= 0 AND score <= 10),
  category TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create whoop_data table
CREATE TABLE whoop_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  recovery_score INTEGER NOT NULL CHECK (recovery_score >= 0 AND recovery_score <= 100),
  sleep_score INTEGER NOT NULL CHECK (sleep_score >= 0 AND sleep_score <= 100),
  strain_score DECIMAL(4,1) NOT NULL CHECK (strain_score >= 0 AND strain_score <= 21),
  heart_rate_variability INTEGER,
  resting_heart_rate INTEGER,
  sleep_duration INTEGER, -- in minutes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create weather_data table
CREATE TABLE weather_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  temperature DECIMAL(4,1) NOT NULL,
  humidity INTEGER,
  conditions TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('finance', 'insurance', 'health', 'legal', 'education', 'other')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_category ON goals(category);
CREATE INDEX idx_goals_type ON goals(type);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_goal_id ON tasks(goal_id);
CREATE INDEX idx_tasks_completed ON tasks(completed);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_day_analysis_user_id ON day_analysis(user_id);
CREATE INDEX idx_day_analysis_date ON day_analysis(date);
CREATE INDEX idx_category_scores_day_analysis_id ON category_scores(day_analysis_id);
CREATE INDEX idx_time_blocks_day_analysis_id ON time_blocks(day_analysis_id);
CREATE INDEX idx_whoop_data_user_id ON whoop_data(user_id);
CREATE INDEX idx_whoop_data_date ON whoop_data(date);
CREATE INDEX idx_weather_data_user_id ON weather_data(user_id);
CREATE INDEX idx_weather_data_date ON weather_data(date);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_category ON documents(category);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_day_analysis_updated_at BEFORE UPDATE ON day_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE whoop_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (these will be customized based on your auth setup)
-- For now, we'll create basic policies that allow users to see only their own data

-- Users can only see their own profile
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Goals policies
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

-- Tasks policies
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- Chat sessions policies
CREATE POLICY "Users can view own chat sessions" ON chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat sessions" ON chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat sessions" ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chat sessions" ON chat_sessions FOR DELETE USING (auth.uid() = user_id);

-- Chat messages policies
CREATE POLICY "Users can view own chat messages" ON chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat messages" ON chat_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chat messages" ON chat_messages FOR DELETE USING (auth.uid() = user_id);

-- Day analysis policies
CREATE POLICY "Users can view own day analysis" ON day_analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own day analysis" ON day_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own day analysis" ON day_analysis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own day analysis" ON day_analysis FOR DELETE USING (auth.uid() = user_id);

-- Category scores policies
CREATE POLICY "Users can view own category scores" ON category_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM day_analysis WHERE id = category_scores.day_analysis_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert own category scores" ON category_scores FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM day_analysis WHERE id = category_scores.day_analysis_id AND user_id = auth.uid())
);
CREATE POLICY "Users can update own category scores" ON category_scores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM day_analysis WHERE id = category_scores.day_analysis_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete own category scores" ON category_scores FOR DELETE USING (
  EXISTS (SELECT 1 FROM day_analysis WHERE id = category_scores.day_analysis_id AND user_id = auth.uid())
);

-- Time blocks policies
CREATE POLICY "Users can view own time blocks" ON time_blocks FOR SELECT USING (
  EXISTS (SELECT 1 FROM day_analysis WHERE id = time_blocks.day_analysis_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert own time blocks" ON time_blocks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM day_analysis WHERE id = time_blocks.day_analysis_id AND user_id = auth.uid())
);
CREATE POLICY "Users can update own time blocks" ON time_blocks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM day_analysis WHERE id = time_blocks.day_analysis_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete own time blocks" ON time_blocks FOR DELETE USING (
  EXISTS (SELECT 1 FROM day_analysis WHERE id = time_blocks.day_analysis_id AND user_id = auth.uid())
);

-- Whoop data policies
CREATE POLICY "Users can view own whoop data" ON whoop_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own whoop data" ON whoop_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own whoop data" ON whoop_data FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own whoop data" ON whoop_data FOR DELETE USING (auth.uid() = user_id);

-- Weather data policies
CREATE POLICY "Users can view own weather data" ON weather_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weather data" ON weather_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weather data" ON weather_data FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weather data" ON weather_data FOR DELETE USING (auth.uid() = user_id);

-- Documents policies
CREATE POLICY "Users can view own documents" ON documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON documents FOR DELETE USING (auth.uid() = user_id); 