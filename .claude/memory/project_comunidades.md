# Comunidades — soft multi-tenancy + per-community reskin

Implemented on branch `feature/comunidades` (Fases 0–5 + "Mis Comunidades" restructure, commit 2cc1cdd). Full reference now lives in CLAUDE.md → "### Comunidades". This note captures the load-bearing decisions + gotchas.

## Model

- `Community` ([server/models/Community.js](server/models/Community.js)): `slug` (immutable — feeds `data-community` selector + URLs), `isBase` (one undeletable base "TurnoCero", holds all historical content, everyone is a member), `joinPolicy` (open/approval/code), `inviteCode` (select:false), `pendingMembers[]`, `skin`, `sections` (Map String→Bool per-community override).
- Membership on `User`: `communityMemberships:[{community, role:'member'|'subadmin', joinedAt}]` + `communityPrefs:{viewing:[], skin}`. `ensureBaseMembership` runs on every signup.
- Content scoping via the `communityScoped` plugin + `config/scopedModels.js` registry (Table/Compartida/Evento/Torneo/Noticia/MathTrade).

## Decisions (locked via Q&A, don't re-litigate)

- `community` kept **`required: false`** at model level — `required:true` taxed every direct `Model.create` (broke ~55 tests). The create routes + `communityService.resolveCreateCommunity` are the guardrail instead.
- Skin neutrals are **theme-split** (accents theme-independent; neutralsDark/neutralsLight via `:root[data-theme][data-community]`). Skin editing is admin-only.
- Reskin opacity variants use `color-mix(in srgb, var(--accent) N%, transparent)`.
- Two section keys: **`comunidades`** (plural) gates the directory; **`comunidad`** (singular) gates the per-community member list. Turning `comunidad` off only hides "Ver miembros" + blocks `/comunidades/:slug` — the community stays listed/joinable.

## Gotchas (cost real debugging time)

- `Community.toJSON` MUST use `toObject({ flattenMaps: true })` — else `JSON.stringify(Map)` serializes `sections`/`skin.*` as `{}` and the client loses every value.
- `getBase()` caches the singleton `_id`; tests clear collections between runs → call `Community.__resetBaseCache()` in `tests/setup.js` afterEach (already wired).
- `GET /api/users` is **shared infra** (DMs, tournament participant search, BG Watch, notif-linked profiles). It is NOT gated by `comunidad`. Only `GET /api/users?community=<id>` (the member list) is gated (global `comunidad` + per-community `sections.comunidad` + membership; admin bypass). `/usuarios/:id` profiles also ungated.
- `/usuarios` (old global list) → redirects to `/comunidades`. Member lists are per-community at `/comunidades/:slug`.
- Per-**target**-community gate (member list) ≠ per-**skin**-community gate (`useSectionEnabled`). Don't use `useSectionEnabled` for the member-list gate.
- Stub child components that use `useCommunity` in parent tests (CommunityPrefs/CommunitiesAdmin/CommunitySelect) — same pattern as the MiBgWatchCard stub.

## Deploy

Run `server/scripts/seed-base-community.js` once on first deploy (idempotent; assigns pre-existing content to base). Needs `DNS_SERVERS` override for Atlas SRV (mirrors server.js). It self-heals — `getBase()` lazily upserts base so `$in:[base]` is never empty.

## "Mis Comunidades" restructure (commit 2cc1cdd)

`/comunidades` = directory, mine-first order, "Ver miembros" per member card → `/comunidades/:slug` (`ComunidadDetail`) which embeds `UsersList` via a `communityId` prop (fetches `?community`, hides global hero/BG-Watch banner). `ComunidadGestion` (`/comunidades/:slug/gestion`) stays for subadmin moderation.
