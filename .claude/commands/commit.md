---
description: Commit changes to current branch
allowed-tools: Bash(git:*)
argument-hint: [optional commit message]
---

## Current State

Branch: !`git branch --show-current`

### Status
!`git status --short`

### Staged Changes
!`git diff --cached --stat 2>/dev/null || echo "Nothing staged"`

### Unstaged Changes
!`git diff --stat 2>/dev/null || echo "Nothing unstaged"`

### Recent Commits (for message style reference)
!`git log --oneline -5`

## Task

1. **Stage**: Add all relevant changes (skip .env, credentials, etc.)
2. **Commit**: Create a commit with a clear message
   - If message provided: use "$ARGUMENTS"
   - If no message: analyze changes and write an appropriate one
   - Follow the repo's commit style from recent commits above
   - End with the standard footer

If there are no changes to commit, say so and skip.

## Note

This command only commits to your local branch. Use `/sync-and-pr` when ready to push and create a PR.
