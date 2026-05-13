---
name: code-review
description: Checklist for reviewing code changes for correctness, maintainability, and test risk.
---
# Code Review Skill

Use this skill when asked to review code or evaluate a patch.

Review in this order:

1. Find correctness bugs, behavioral regressions, and unsafe edge cases.
2. Check whether errors fail loudly and close to the source.
3. Check whether the change is scoped and avoids unrelated refactors.
4. Check whether tests cover the meaningful risk.

Return findings first, ordered by severity. Include file and line references when available.
