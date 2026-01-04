---
description: Sync with main, resolve conflicts, and create PR
allowed-tools: Bash(git:*), Bash(gh:*), AskUserQuestion, Read, Edit
argument-hint: [optional PR title]
---

## Current State

Branch: !`git branch --show-current`
Base branch: main

### Local Status
!`git status --short`

### Main Branch Status
!`git fetch origin main --quiet && git log --oneline HEAD..origin/main 2>/dev/null | head -5 || echo "Up to date with main"`

### Divergence Check
!`git rev-list --left-right --count HEAD...origin/main 2>/dev/null || echo "Cannot compare"`

## Task

**Goal**: Sync current branch with latest main, resolve any conflicts, and create a PR.

### Step 1: Fetch and Merge Main

1. Fetch latest changes from origin/main
2. Attempt to merge origin/main into current branch
3. If merge succeeds cleanly: proceed to Step 3
4. If conflicts occur: proceed to Step 2

### Step 2: Resolve Conflicts (if any)

For each conflicted file:
1. Read the file to see the conflict markers
2. Analyze the conflict:
   - If it's clear which version to keep (e.g., new auth code vs old code): auto-resolve
   - If it's unclear or involves business logic changes: use AskUserQuestion to ask user which version to keep
3. Edit the file to resolve conflicts
4. Stage the resolved file

**Auto-resolve when**:
- One side is clearly a deletion and the other is unchanged
- One side is new code and the other doesn't exist
- Changes are in completely different parts of the file

**Ask user when**:
- Both sides modified the same lines
- Business logic conflicts
- Unclear which version is correct

### Step 3: Commit Changes

If there were changes from main or conflict resolutions:
1. Stage all changes
2. Commit with message: "sync with main and resolve conflicts" or "merge main into [branch-name]"
3. Add standard commit footer

### Step 4: Push Branch

1. Push current branch to origin
2. Set upstream if not already set

### Step 5: Create Pull Request

1. Use `gh pr create` to create a PR
2. Title: Use $ARGUMENTS if provided, otherwise generate from branch name and recent commits
3. Body should include:
   - Summary of changes
   - Note about main branch sync if applicable
   - Test plan
   - Standard footer

## Important Notes

- Never force push
- Always ask before making destructive changes
- If user is on main branch, warn them and suggest creating a feature branch first
- If there are uncommitted changes, stash them before merging and pop after
