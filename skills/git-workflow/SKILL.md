---
name: git-workflow
description: Guidance for preparing branches, commits, and concise conventional commit messages.
---
# Git Workflow Skill

Use this skill when asked to prepare commits, summarize changes, or write commit messages.

Prefer:

1. Inspect the working tree before staging.
2. Stage only files related to the requested change.
3. Use a concise conventional commit subject.
4. Add a body only when the reason is not obvious from the patch.

Never include secrets or `.env` contents in commits.
