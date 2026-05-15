---
name: feedback-sidebar-bottomnav-sync
description: "When modifying Sidebar order or structure, always ask the user whether to apply the same change to BottomNav"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ceb615a9-8d43-4bba-9b5c-fab71ee74669
---

Whenever the Sidebar (`Sidebar.jsx`) order or item structure is modified, always ask the user whether to apply the same change to `BottomNav.jsx` as well.

**Why:** The user wants both navs to stay in sync and doesn't want to have to remind me each time.

**How to apply:** After any edit to Sidebar NAV items (add, remove, reorder), proactively ask: "¿Aplico el mismo cambio en el BottomNav?"
