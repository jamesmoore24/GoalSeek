---
description: Sync main and create a new worktree for the task at hand
allowed-tools: Bash(git:*), Bash(ls:*)
argument-hint: [optional description of what you're building]
---

## Current State

Branch: !`git branch --show-current`
Worktrees: !`git worktree list`

### Main Branch Status
!`git fetch origin main 2>&1 && git log --oneline HEAD..origin/main 2>/dev/null | head -5 || echo "Already up to date"`

## Task

1. **Sync main branch**:
   - Fetch latest from origin
   - If on main with no uncommitted changes, pull the latest
   - If not on main, just fetch (don't switch branches)

2. **Generate a clear branch name**:
   - Based on "$ARGUMENTS" if provided, OR
   - Based on our recent conversation about what we're building
   - Format: `kebab-case`, 2-4 words
   - Be descriptive and obvious:
     - `add-user-auth` for authentication
     - `fix-chat-alignment` for UI fixes
     - `improve-query-perf` for optimization

3. **Create the worktree**:
   - Directory: `../GoalSeek-{branch-name}` (sibling to current repo)
   - Branch: the generated name
   - Base: origin/main (latest remote main)

4. **Report**: Show the worktree path and branch name.

Example:
```bash
git fetch origin main
git worktree add ../GoalSeek-{branch-name} -b {branch-name} origin/main
```
