# Memory Index — Turnocero

- [Claudio Hollman — developer profile](user_profile.md) — sole dev/owner, full-stack, Argentine Spanish UI, English commit messages
- [Turnocero current feature set](project_features.md) — Noticias, Compartidas, Friends, public browsing, Sidebar/BottomNav/GuestNavbar — features beyond CLAUDE.md
- [Code style and workflow preferences](feedback_style.md) — commit-msg/UI language, BGG warning, CSS Modules, no tests
- [Page padding system](padding_system.md) — `--page-padding`, `--page-padding-left`, `--page-padding-mobile` variables; patterns per page type
- [Skeleton shimmer pattern](skeleton_pattern.md) — standard for all loading states; which screens are done, which are pending (BggProfile skipped)
- [Sidebar/BottomNav sync](feedback_sidebar_bottomnav_sync.md) — always ask about BottomNav when modifying Sidebar order or structure
- [Plans folder location](feedback_plans_location.md) — Plans go in the project's `plans/` folder, not `~/.claude/plans/`
- [Admin "view as user" mode](feedback_admin_view_as_user.md) — admin-only features must respect the `viewAsUser` toggle (filter/hide privileged data client-side)
