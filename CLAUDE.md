# GoalSeek - AI-Powered Day Planning Assistant

## Project Overview

GoalSeek is an AI-powered day planning and productivity assistant that helps users optimize their time through:
- Real-time state tracking (energy, focus, stress, body readiness, social battery)
- Constraint-based scheduling with hard/soft rules
- Weekly target tracking across work categories and health metrics
- Activity logging with tags and intensity levels
- AI-generated next-step recommendations using context-aware prompting

## Tech Stack

**Frontend:**
- Next.js 15+ (App Router)
- React 19+
- TypeScript
- Tailwind CSS
- shadcn/ui components
- React Hook Form + Zod validation

**Backend:**
- Next.js API routes
- Supabase (PostgreSQL with RLS)
- OpenRouter API (Gemini 2.5 Flash for planning)

**Native:**
- Capacitor 8 (iOS app support)
- @capacitor-community/media (photo library access)

## Project Structure

```
/app
  /api
    /chat/route.ts          # Chat interface endpoint (simplified)
    /plan/generate/route.ts # Plan generation endpoint
    /plan/[planId]/route.ts # Plan status updates
    /profiles/route.ts      # User profile management
    /rules/route.ts         # Constraint rules CRUD
    /state/route.ts         # State snapshot management
    /weekly-targets/route.ts # Weekly target CRUD
  /components
    /planning/              # Planning UI components
      planner.tsx           # Main planning dashboard
      state-form.tsx        # State capture form
      quick-log.tsx         # Activity logging
      plan-card.tsx         # Plan display
    /ui/                    # shadcn components
    chat-interface.tsx      # Chat UI with photo picker
    inline-photo-picker.tsx # Native photo picker
  /plan/page.tsx           # Planning route
  /page.tsx                # Home/chat route
  layout.tsx               # Root layout with theme provider

/lib
  /planning
    context.ts             # Build planning context for LLM
    derive.ts              # Calculate derived metrics/flags
    prompt.ts              # LLM system/user prompts
  /schemas
    planning.ts            # Zod validation schemas
  capacitor.ts             # Platform detection helpers
  openai.ts                # OpenRouter client
  supabase.ts              # Supabase client

/hooks
  use-photo-picker.ts      # Native photo library access

/types
  planning.ts              # TypeScript types

/supabase/migrations
  001_day_planning.sql     # Database schema

/ios                       # Generated iOS project (gitignored)

capacitor.config.ts        # Capacitor configuration
```

## Database Schema

### Core Tables

**profiles** - User preferences
- timezone, bedtime, caffeine_cutoff_time
- intense_block_duration (minutes)
- day_start_time, day_end_time

**weekly_targets** - Weekly goals
- Work: meta_hours, startup_hours, hedge_hours
- Health: cardio_sessions, strength_sessions, mobility_sessions
- Other: social_hours, learning_hours, writing_hours

**rules** - Hard/soft constraints
- rule_type: 'hard' | 'soft'
- description (natural language)
- is_active boolean

**day_logs** - Append-only activity log
- tag: META, STARTUP, HEDGE, HEALTH, SOCIAL, ADMIN, RECOVERY, MEETING, COMMUTE, LEARNING, WRITING, ERRANDS
- health_type: cardio, strength, mobility (nullable)
- intensity: low, medium, high
- duration_minutes, description, outcome, needs_followup

**state_snapshots** - Real-time state
- location_context: home, office, gym, outdoors, transit, social, errands
- sleep_quality (1-10), caffeine_consumed, last_caffeine_time
- energy_level, focus_level, stress_level (1-10)
- body_readiness, social_battery (1-10)
- snapshot_images (base64 array for multimodal context)

**plans** - AI-generated plans
- status: proposed, accepted, skipped, completed
- plan_data (JSON): next_block, secondary_block, pacing, constraint_checks, fallbacks

**plan_feedback** - User feedback
- rating (1-5), followed_plan (boolean)
- feedback_text

All tables have RLS policies for user isolation and proper indexes.

## Key Features

### 1. Day Planning System

**Context Assembly** (`lib/planning/context.ts`)
- Gathers profile, weekly targets, active rules, today's logs, current state
- Passes comprehensive context to LLM

**Derived Metrics** (`lib/planning/derive.ts`)
- Weekly progress by tag and health type
- Timing windows (bedtime countdown, no-intense window)
- Constraint flags (health/social floors met, caffeine allowed, outdoor exposure)

**LLM Prompting** (`lib/planning/prompt.ts`)
- System prompt: LLM acts as "executive scheduling controller"
- User message: Structured context with progress, state, rules, logs
- Multimodal support: Can include images from state snapshots

**Plan Generation** (`/api/plan/generate`)
- Takes state snapshot (current or saved ID)
- Returns structured plan with:
  - Next activity block (duration, intensity, task, definition of done)
  - Secondary block option
  - Pacing suggestions
  - Constraint checks
  - Fallback options

### 2. iOS Native Support

**Capacitor Integration**
- App ID: `com.goalseek.app`
- Static export from Next.js
- Development server for local testing

**Photo Library Access**
- `use-photo-picker.ts` hook requests permissions, loads recent photos
- `inline-photo-picker.tsx` provides iMessage-style photo grid
- Platform detection falls back to file input on web
- Converts photos to base64 for multimodal API calls

**Development Scripts**
```bash
npm run cap:sync        # Sync web assets to native
npm run cap:open:ios    # Open Xcode project
npm run build:ios       # Build and sync
npm run dev:ios         # Build, sync, and open Xcode
```

### 3. Chat Interface

**Simplified API** (`/api/chat/route.ts`)
- OpenRouter/Gemini integration
- Math formatting via LaTeX
- Removed complex multi-model routing

**Photo Integration** (`chat-interface.tsx`)
- Detects native platform
- Shows inline photo picker on iOS for GPT-4o
- Falls back to file input on web

## Fitness Data Integration (Planned)

### Overview

Integrate Garmin and Strava data to automatically provide fitness context to all chat interactions and planning decisions. This replaces manual entry of body readiness, sleep quality, and activity history with real data.

### Data Sources

**Garmin Connect API**
- Sleep data: duration, sleep score, sleep stages (deep, light, REM)
- Body Battery: current level, recharge/drain history
- HRV (Heart Rate Variability): stress indicator, recovery status
- Resting heart rate trends
- Steps and daily movement
- Stress levels throughout the day

**Strava API**
- Recent activities: runs, rides, swims, strength sessions
- Activity details: distance, duration, pace, heart rate zones
- Training load and fitness/freshness scores
- Weekly training volume

### Integration Pattern

Follow the existing integrations pattern used for Google Calendar, Google Tasks, Whoop, and Weather.

**Update `UserIntegrations` interface in `lib/supabase.ts`:**
```typescript
export interface UserIntegrations {
  // ... existing fields
  garmin_enabled?: boolean;
  garmin_access_token?: string;
  garmin_refresh_token?: string;
  garmin_token_expires_at?: string;
  strava_enabled?: boolean;
  strava_access_token?: string;
  strava_refresh_token?: string;
  strava_token_expires_at?: string;
}
```

**Add to `lib/integrations.ts`:**
```typescript
export interface GarminData {
  bodyBattery: number;
  sleep: { duration: number; score: number; stages: object };
  hrv: { status: string; value: number };
  stress: number;
  restingHR: number;
  steps: number;
}

export interface StravaActivity {
  id: string;
  type: string;
  name: string;
  startTime: Date;
  duration: number;
  distance?: number;
  avgHeartRate?: number;
  sufferScore?: number;
}

export async function getGarminData(): Promise<GarminData> { ... }
export async function getStravaActivities(): Promise<StravaActivity[]> { ... }
```

### Settings UI

Add Garmin and Strava toggles to the existing `/settings` page alongside Google Calendar and other integrations:
- Connect/disconnect buttons with OAuth flow
- Show connection status and last sync time
- Enable/disable toggle for each integration

### Database Schema Additions

**garmin_daily_summaries** - Cached daily health metrics
- user_id, date
- sleep_score, sleep_duration_minutes
- body_battery_high, body_battery_low
- avg_stress_level, resting_heart_rate
- steps, active_minutes
- hrv_status ('balanced' | 'low' | 'high')

**strava_activities** - Cached Strava activities
- user_id, strava_id, activity_type, name
- start_time, duration_seconds
- distance_meters, avg_heart_rate
- suffer_score, perceived_exertion

### Implementation Plan

**Step 1: OAuth Setup**
- Add `/api/integrations/garmin/connect` - initiates OAuth flow
- Add `/api/integrations/garmin/callback` - handles OAuth callback, stores tokens in UserIntegrations
- Add `/api/integrations/strava/connect` and `/callback` routes
- Add enable/disable toggles to `/settings` page

**Step 2: Data Sync**
- Add `getGarminData()` and `getStravaActivities()` to `lib/integrations.ts`
- Add background sync via Supabase Edge Functions or cron
- Sync last 7 days on initial connect, then daily updates

**Step 3: Context Integration**
- Update `lib/planning/context.ts` to include fitness data when enabled
- Replace manual body_readiness input with Garmin Body Battery
- Replace manual sleep_quality with Garmin sleep score
- Auto-populate recent health activities from Strava

**Step 4: Chat Context**
- Create `/lib/fitness/summary.ts` - generates natural language fitness summary
- Inject fitness context into all chat system prompts when integrations are enabled
- Include: last night's sleep, current body battery, recent workouts, training load

### Context Format for LLM

```
## Fitness Context (from Garmin & Strava)

**Today's Readiness:**
- Body Battery: 65/100 (started at 85, drained 20 points)
- Last Night's Sleep: 7h 12m, score 78/100 (light sleep dominant)
- HRV Status: Balanced
- Resting HR: 52 bpm (normal range)
- Stress: Low-moderate throughout morning

**Recent Activity (last 7 days):**
- Monday: 45min run, 5.2mi, moderate effort (Strava)
- Wednesday: 60min strength training (Strava)
- Friday: 30min recovery ride (Strava)
- Weekly training load: 4.2 hours, trending up

**Recovery Notes:**
- 2 rest days since last intense session
- Body Battery fully recharged overnight
- Good conditions for high-intensity work
```

### Environment Variables

Add to `.env.local`:
```
GARMIN_CLIENT_ID=
GARMIN_CLIENT_SECRET=
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
```

### Constraints and Rules Integration

Fitness data enables smarter constraint checking:
- Block high-intensity work when Body Battery < 30
- Suggest recovery activities after 3+ consecutive training days
- Warn about sleep debt when sleep score < 60 for 2+ days
- Auto-adjust intensity recommendations based on HRV status

## Plaid Financial Integration

### Overview

Integrate Plaid to provide financial context (balances, transactions, investments, liabilities) to all chat interactions and planning decisions. Financial data is contextual - it feeds into the LLM's awareness without requiring a dedicated UI.

### Data Sources

**Plaid API Products:**
- Transactions: 30-day transaction history with merchant names and categories
- Auth: Account and routing numbers
- Investments: Holdings, securities, and portfolio values
- Liabilities: Credit cards, student loans, mortgages

### Implementation

**Library:** `/lib/plaid.ts`
- `createLinkToken(userId)` - Creates token for Plaid Link widget
- `exchangePublicToken(publicToken)` - Exchanges for access token
- `syncAccounts/Transactions/Investments/Liabilities(userId)` - Fetches and caches data
- `getFinancialSummary(userId)` - Aggregates data for LLM context
- `formatFinancesForLLM(summary)` - Formats context string

**API Routes:** `/app/api/integrations/plaid/`
- `POST /link-token` - Create Plaid Link token
- `POST /callback` - Exchange public token, store access token, trigger sync
- `GET /status` - Check connection status and settings
- `PATCH /settings` - Update privacy toggles
- `POST /disconnect` - Remove tokens and cached data
- `POST /sync` - Manual data refresh

**Types:** `/types/plaid.ts`
- `PlaidAccount`, `PlaidTransaction`, `PlaidHolding`, `PlaidLiability`
- `FinancialSummary` - Aggregated data for LLM
- `PlaidSettings` - Privacy configuration

### Database Schema

**user_integrations additions:**
- `plaid_connected`, `plaid_access_token`, `plaid_item_id`
- `plaid_institution_name`, `plaid_last_sync_at`
- Privacy: `plaid_sync_enabled`, `plaid_share_account_names`, `plaid_share_transaction_details`, `plaid_share_balances`

**Caching tables (with RLS):**
- `plaid_accounts` - Account info and balances
- `plaid_transactions` - 30-day transaction cache
- `plaid_holdings` - Investment positions
- `plaid_liabilities` - Credit/loan details

### Settings UI

In `/app/settings/page.tsx`:
- Connect button triggers Plaid Link modal (via `react-plaid-link`)
- Shows institution name and last sync time
- Manual "Sync Now" button
- Privacy toggles for account names, transactions, balances
- Disconnect functionality

### Context Format for LLM

```
## Financial Overview (Chase Bank)

### Net Worth: $127,450.32
- Cash & Checking: $12,345.67
- Investments: $98,234.56
- Credit Card Debt: $2,345.67
- Loans & Liabilities: $15,784.24

### Accounts
- Chase Total Checking (checking): $8,234.56
- Vanguard Brokerage (investment): $98,234.56

### Monthly Cash Flow (Last 30 Days)
- Income: $8,500.00
- Spending: $4,234.56
- Net: $4,265.44

### Spending by Category
- Food and Drink: $856.23
- Travel: $1,234.56
- Shopping: $678.90

### Recent Transactions
- Jan 3: Whole Foods - $67.89
- Jan 2: Uber - $23.45

### Upcoming Payments
- Chase Sapphire: $150.00 due Jan 15
```

### Environment Variables

```
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox  # or 'development' or 'production'
PLAID_PRODUCTS=transactions,investments,liabilities
PLAID_COUNTRY_CODES=US
```

### Chat Integration

Financial summary is fetched in `buildUnifiedChatContext()` and formatted via `formatFinancesForLLM()` into the system prompt. The LLM can:
- Answer questions about spending and net worth
- Consider budget when planning activities
- Factor in upcoming payments for scheduling
- Provide holistic planning considering financial health

## Development Conventions

### Commit Style
- Lowercase, brief messages
- Focus on "what" not "why"
- Examples: "add day planning system", "fix safari ui text box"

### Code Patterns
- Type-safe APIs with Zod validation
- Server components by default, client components when needed
- RLS policies on all Supabase tables
- Context-driven LLM prompting
- Progressive enhancement (web-first, native-enhanced)

### File Organization
- API routes in `/app/api/[feature]/route.ts`
- UI components in `/app/components/[feature]/`
- Business logic in `/lib/[feature]/`
- Types in `/types/` or colocated with logic
- Schemas in `/lib/schemas/`

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENROUTER_API_KEY=
```

## Key Dependencies

- `@supabase/supabase-js` - Database client
- `@capacitor/core`, `@capacitor/ios` - Native app framework
- `@capacitor-community/media` - Photo library access
- `zod` - Schema validation
- `react-hook-form` - Form handling
- `next-themes` - Theme management
- `sonner` - Toast notifications

## Architecture Notes

**Context-Driven Planning**: The system gathers extensive context (profile, targets, progress, rules, state) to feed the LLM, enabling constraint-aware recommendations.

**Constraint-Based Scheduling**: Plans respect hard constraints (sleep protection, no double-intense blocks) and soft constraints (health/social floors, weekly targets).

**Multimodal Capability**: Plans can include images from state snapshots for visual context (e.g., cluttered workspace, outdoor setting).

**Progressive Enhancement**: Web-first architecture with iOS native features layered on via Capacitor.

**Type Safety**: Full Zod validation on all API request/response contracts.

## Testing Notes

- Supabase migration must run before testing planning features
- iOS build requires Xcode and iOS simulator/device
- Photo picker requires native iOS or falls back to file input
- Planning requires user profile and weekly targets to be set
