/**
 * Slash Command Registry
 *
 * Defines available slash commands and their metadata.
 * Commands can trigger workflows or perform inline actions.
 */

export interface SlashCommandArg {
  name: string;
  description: string;
  optional: boolean;
}

export interface SlashCommand {
  name: string;
  description: string;
  icon: string;  // Lucide icon name
  workflow_slug?: string;  // If command triggers a workflow
  args?: SlashCommandArg[];
}

/**
 * Available slash commands
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'planmyday',
    description: 'Generate an optimized daily agenda based on your calendar and goals',
    icon: 'Sparkles',
    workflow_slug: 'planmyday',
    args: [
      {
        name: 'date',
        description: 'Target date (default: today)',
        optional: true,
      },
    ],
  },
  // Future commands can be added here:
  // {
  //   name: 'review',
  //   description: 'Weekly review of progress across all pursuits',
  //   icon: 'BarChart',
  //   workflow_slug: 'weekly-review',
  // },
  // {
  //   name: 'focus',
  //   description: 'Start a focused work session',
  //   icon: 'Target',
  //   workflow_slug: 'focus-session',
  // },
  // {
  //   name: 'log',
  //   description: 'Quick activity logging',
  //   icon: 'PenLine',
  //   args: [
  //     { name: 'activity', description: 'What you worked on', optional: false },
  //   ],
  // },
];

/**
 * Filter commands by query prefix
 */
export function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase().trim();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(cmd => cmd.name.toLowerCase().startsWith(q));
}

/**
 * Get a command by exact name
 */
export function getCommand(name: string): SlashCommand | undefined {
  return SLASH_COMMANDS.find(cmd => cmd.name.toLowerCase() === name.toLowerCase());
}

/**
 * Parse date from command arguments
 * Supports: "today", "tomorrow", "YYYY-MM-DD", or relative like "2025-01-15"
 */
export function parseTargetDate(arg?: string): string {
  if (!arg) {
    return formatDate(new Date());
  }

  const lower = arg.toLowerCase();
  const today = new Date();

  if (lower === 'today') {
    return formatDate(today);
  }

  if (lower === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }

  if (lower === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
  }

  // Try parsing as date string
  const parsed = new Date(arg);
  if (!isNaN(parsed.getTime())) {
    return formatDate(parsed);
  }

  // Default to today if parsing fails
  return formatDate(today);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
