# Memory Index

- [Turnocero current feature set](project_features.md) — Noticias, Compartidas, Friends, public browsing, Sidebar/BottomNav/GuestNavbar, admin moderation — features beyond CLAUDE.md
- [Claudio Hollman — developer profile](user_profile.md) — sole dev/owner, full-stack, Argentine Spanish UI, English commit messages
- [Skeleton shimmer pattern](skeleton_pattern.md) — standard for all loading states; which screens are done, which are pending (BggProfile skipped)
- [Page padding system](padding_system.md) — `--page-padding`, `--page-padding-left`, `--page-padding-mobile` variables; patterns per page type
- [Sidebar/BottomNav sync](feedback_sidebar_bottomnav_sync.md) — always ask about BottomNav when modifying Sidebar order or structure
- [Deleted user UI convention](feedback_deleted_user.md) — null populated user refs render as "Usuario eliminado" via UserRef/getUserDisplay; never access user.username directly
- [VSCode ESLint setup](reference_vscode_eslint.md) — per-machine `.vscode/settings.json` pointing ESLint extension at `./client` (flat config lives there, not at repo root)
