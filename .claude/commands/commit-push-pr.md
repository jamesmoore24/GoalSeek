---
description: Commit all changes, push to branch, and create PR
allowed-tools: Bash(git:*), Bash(gh:*)
argument-hint: [optional commit message]
---

## Current State

Branch: !`git branch --show-current`
Remote tracking: !`git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "No upstream set"`

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
3. **Push**: Push to the current branch (set upstream if needed)
4. **PR**: Create a pull request using `gh pr create` with:
   - Clear title summarizing the changes
   - Body with Summary and Test plan sections
   - Standard footer

If there are no changes to commit, say so and skip.
