# GoalSeek API Documentation

## Overview

The GoalSeek API provides endpoints for managing personal goals, tasks, chat sessions, and AI interactions. All endpoints require authentication (currently using mock user IDs for development).

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://your-domain.com/api`

## Authentication

Currently using mock user IDs. In production, this will be replaced with Supabase Auth.

## Endpoints

### Goals

#### GET /goals

Get all goals for the current user.

**Query Parameters:**

- `type` (optional): Filter by goal type (`short-term` or `long-term`)
- `category` (optional): Filter by category

**Response:**

```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Complete React Course",
    "description": "Learn React fundamentals",
    "progress": 75,
    "deadline": "2024-01-31",
    "category": "Learning",
    "priority": "High",
    "type": "short-term",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /goals

Create a new goal.

**Request Body:**

```json
{
  "title": "Complete React Course",
  "description": "Learn React fundamentals",
  "progress": 0,
  "deadline": "2024-01-31",
  "category": "Learning",
  "priority": "High",
  "type": "short-term"
}
```

#### GET /goals/{goalId}

Get a specific goal.

#### PUT /goals/{goalId}

Update a goal.

#### DELETE /goals/{goalId}

Delete a goal.

### Tasks

#### GET /tasks

Get all tasks for the current user.

**Query Parameters:**

- `completed` (optional): Filter by completion status (`true` or `false`)
- `priority` (optional): Filter by priority (`High`, `Medium`, `Low`)
- `category` (optional): Filter by category
- `date` (optional): Filter by scheduled date (YYYY-MM-DD)

**Response:**

```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "goal_id": "uuid",
    "title": "Review React components",
    "description": "Go through React component examples",
    "completed": false,
    "priority": "High",
    "category": "Learning",
    "estimated_time": 120,
    "deadline": "2024-01-15T14:00:00Z",
    "scheduled_time": "2024-01-15T10:00:00Z",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /tasks

Create a new task.

**Request Body:**

```json
{
  "title": "Review React components",
  "description": "Go through React component examples",
  "completed": false,
  "priority": "High",
  "category": "Learning",
  "estimated_time": 120,
  "deadline": "2024-01-15T14:00:00Z",
  "scheduled_time": "2024-01-15T10:00:00Z",
  "goal_id": "uuid"
}
```

#### GET /tasks/{taskId}

Get a specific task.

#### PUT /tasks/{taskId}

Update a task.

#### DELETE /tasks/{taskId}

Delete a task.

### Chat Sessions

#### GET /chat/sessions

Get all chat sessions for the current user.

**Response:**

```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "title": "New Chat",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /chat/sessions

Create a new chat session.

**Request Body:**

```json
{
  "title": "New Chat"
}
```

### Chat Messages

#### GET /chat/sessions/{sessionId}/messages

Get all messages in a chat session.

**Response:**

```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "session_id": "uuid",
    "role": "user",
    "content": "What should I focus on today?",
    "metadata": {},
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /chat/sessions/{sessionId}/messages

Send a message in a chat session.

**Request Body:**

```json
{
  "content": "What should I focus on today?",
  "metadata": {
    "agent_type": "goal_assistant"
  }
}
```

### AI Chat

#### POST /chat

Send a message to the AI assistant.

**Request Body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What should I focus on today?"
    }
  ]
}
```

**Response:**
Streaming response from the AI assistant.

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message"
}
```

**HTTP Status Codes:**

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

Currently no rate limiting implemented. Will be added in production.

## Data Models

### Goal

- `id`: UUID (primary key)
- `user_id`: UUID (foreign key to users)
- `title`: String (required)
- `description`: String (optional)
- `progress`: Integer (0-100)
- `deadline`: Date (optional)
- `category`: String (required)
- `priority`: String (High/Medium/Low)
- `type`: String (short-term/long-term)
- `created_at`: Timestamp
- `updated_at`: Timestamp

### Task

- `id`: UUID (primary key)
- `user_id`: UUID (foreign key to users)
- `goal_id`: UUID (foreign key to goals, optional)
- `title`: String (required)
- `description`: String (optional)
- `completed`: Boolean
- `priority`: String (High/Medium/Low)
- `category`: String (required)
- `estimated_time`: Integer (minutes, optional)
- `deadline`: Timestamp (optional)
- `scheduled_time`: Timestamp (optional)
- `created_at`: Timestamp
- `updated_at`: Timestamp

### ChatSession

- `id`: UUID (primary key)
- `user_id`: UUID (foreign key to users)
- `title`: String (required)
- `created_at`: Timestamp
- `updated_at`: Timestamp

### ChatMessage

- `id`: UUID (primary key)
- `user_id`: UUID (foreign key to users)
- `session_id`: UUID (foreign key to chat_sessions)
- `role`: String (user/assistant)
- `content`: String (required)
- `metadata`: JSONB (optional)
- `created_at`: Timestamp

## Future Endpoints

The following endpoints are planned for future releases:

- `GET /day-analysis` - Get daily analysis
- `POST /day-analysis` - Create daily analysis
- `GET /whoop/data` - Get Whoop fitness data
- `GET /weather/data` - Get weather data
- `GET /documents` - Get user documents
- `POST /documents` - Upload documents
- `GET /users` - Get user profile
- `PUT /users` - Update user profile
