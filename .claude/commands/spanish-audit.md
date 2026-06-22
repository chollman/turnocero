**Deprecated — use `/i18n-audit` instead.**

As of 2026-06-22 Turnocero is bilingual (Argentine Spanish default + English via
the `/perfil` toggle). The old rule this command enforced — "hardcode all
user-facing text in Argentine Spanish" — is **superseded**. User-facing strings
now go through i18n keys present in **both** `es` and `en` (see
`.claude/memory/feedback_i18n_keys.md`).

The audit's job inverted: instead of flagging English and forcing hardcoded
Spanish, flag **hardcoded literals (in either language)** in user-facing
positions and convert them to i18n keys with `es` + `en` values, and flag missing
translations / hardcoded `"es-AR"` formatting.

→ Run **`/i18n-audit`** (`.claude/commands/i18n-audit.md`).
