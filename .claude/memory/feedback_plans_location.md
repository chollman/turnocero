---
name: plans-folder-location
description: Where to save implementation plan files for the Turnocero project
metadata:
  type: feedback
---

Always create plan files inside the project's own `plans/` folder at `/Users/claudiohollman/Projects/turnocero/plans/`, NEVER in `~/.claude/plans/`.

**Why:** User wants plans in the repo alongside the code. Confirmed and reiterated explicitly.

**How to apply:** Even when plan mode forces a path in `~/.claude/plans/`, write the plan to `/Users/claudiohollman/Projects/turnocero/plans/<descriptive-name>.md` and immediately move/copy it there when exiting plan mode. Never leave plans in the global Claude folder.
