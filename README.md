# GoalSeek - Personal AI Assistant

A personal AI assistant that helps users achieve their goals and optimize daily performance. Built with Next.js, Supabase, and AI integration.

## Features

- **AI-Powered Chat Interface**: Chat with your personal assistant about goals, tasks, and daily optimization
- **Goal Tracking**: Set and track short-term and long-term goals with progress monitoring
- **Task Management**: Create, organize, and track tasks with priority levels and deadlines
- **Day Analysis**: Get insights and recommendations based on your daily performance
- **Mobile-Optimized**: Responsive design optimized for mobile devices
- **Chat History**: Persistent chat sessions with conversation history
- **Database Integration**: Full Supabase integration for data persistence

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: Radix UI, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o via AI SDK
- **Authentication**: Supabase Auth (planned)
- **Deployment**: Vercel (recommended)

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account
- OpenAI API key

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd GoalSeek
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from the project settings
3. Run the database schema:

```bash
# Copy the schema to your Supabase SQL editor
cat supabase/schema.sql
```

4. Execute the SQL in your Supabase SQL editor

### 4. Environment Variables

Copy the environment template and create your `.env` file:

```bash
cp env-template.txt .env
```

Then edit `.env` and add your API keys:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI (primary AI provider)
OPENAI_API_KEY=your_openai_api_key

# Cerebras AI (alternative AI provider)
CEREBRAS_API_KEY=your_cerebras_api_key_here
CEREBRAS_API_URL=https://api.cerebras.ai/v1

# Optional integrations for future features
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
WHOOP_CLIENT_ID=your_whoop_client_id
WHOOP_CLIENT_SECRET=your_whoop_client_secret
WEATHER_API_KEY=your_weather_api_key
```

### 5. Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## API Endpoints

### Goals

- `GET /api/goals` - Get user goals
- `POST /api/goals` - Create a new goal
- `GET /api/goals/[goalId]` - Get a specific goal
- `PUT /api/goals/[goalId]` - Update a goal
- `DELETE /api/goals/[goalId]` - Delete a goal

### Tasks

- `GET /api/tasks` - Get user tasks
- `POST /api/tasks` - Create a new task
- `GET /api/tasks/[taskId]` - Get a specific task
- `PUT /api/tasks/[taskId]` - Update a task
- `DELETE /api/tasks/[taskId]` - Delete a task

### Chat

- `POST /api/chat` - Send message to AI assistant
- `GET /api/chat/sessions` - Get chat sessions
- `POST /api/chat/sessions` - Create new chat session
- `GET /api/chat/sessions/[sessionId]/messages` - Get chat messages
- `POST /api/chat/sessions/[sessionId]/messages` - Send message in session

## Database Schema

The application uses the following main tables:

- **users**: User profiles and preferences
- **goals**: Short-term and long-term goals
- **tasks**: Individual tasks with priorities and deadlines
- **chat_sessions**: Chat conversation sessions
- **chat_messages**: Individual messages within sessions
- **day_analysis**: Daily performance analysis
- **whoop_data**: Fitness data from Whoop integration
- **weather_data**: Weather information
- **documents**: User documents and files

## Key Features

### AI Assistant

The AI assistant has access to:

- User goals and progress
- Today's tasks and schedule
- Recent activity and performance metrics
- Calendar events
- Fitness and health data

### Mobile Interface

- Full-screen chat interface
- Slide-out sidebar for chat history
- Mobile-optimized design
- Touch-friendly interactions

### Data Integration

- Real-time data from Supabase
- Structured data for accurate AI responses
- Persistent chat history
- Goal and task tracking

## Development

### Project Structure

```
GoalSeek/
├── app/
│   ├── api/           # API routes
│   ├── components/    # React components
│   └── page.tsx      # Main page
├── components/        # Shared UI components
├── lib/              # Utilities and configurations
├── supabase/         # Database schema
├── types/            # TypeScript type definitions
└── openapi.yaml      # API specification
```

### Adding New Features

1. **Database**: Add new tables to `supabase/schema.sql`
2. **API**: Create new routes in `app/api/`
3. **Types**: Update `types/index.ts` with new interfaces
4. **Components**: Add new UI components as needed

### Authentication (Planned)

The application is designed to support Supabase Auth for user authentication. Currently using mock user IDs for development.

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production

Make sure to set all required environment variables in your deployment platform.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Roadmap

- [ ] User authentication with Supabase Auth
- [ ] Google Calendar integration
- [ ] Google Tasks integration
- [ ] Whoop API integration
- [ ] Weather API integration
- [ ] Document upload and management
- [ ] Advanced analytics and insights
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Team collaboration features

## Support

For support, please open an issue in the GitHub repository or contact the development team.
