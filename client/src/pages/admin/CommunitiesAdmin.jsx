import { useState, useEffect, useCallback } from "react";
import { useTranslation, Trans } from "react-i18next";
import axios from "axios";
import { API } from "../../api/endpoints";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";
import styles from "./CommunitiesAdmin.module.css";

const POLICY_VALUES = ["open", "approval", "code"];

const errMsg = (err, fallback) => err?.response?.data?.message || fallback;

// ── Tokens de skin ──
// buildSkinCss mapea cualquier key camelCase → --kebab. Los inputs `type=color`
// solo manejan hex; los tokens con alpha (rgba) usan input de texto validado.
// Los defaults son los valores base de index.css, así "guardar sin tocar" no
// cambia nada. Las variantes de opacidad (--amber-10..50, etc.) NO se exponen:
// se derivan por color-mix del accent base y cascadean solas.

// Validación de color para los inputs de texto (espeja sanitizeSkinTokens del server).
const COLOR_RE =
  /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$|^rgba?\(\s*[\d.,%/\s]+\)$/i;

// Acentos (theme-independent → van en `accents`).
const ACCENT_HEX_KEYS = [
  "amber",
  "amberLight",
  "amberDark",
  "red",
  "green",
  "orange",
  "purple",
];
const ACCENT_ALPHA_KEYS = ["amberGlow", "borderAmber"];
const ACCENT_DEFAULTS = {
  amber: "#1888ef",
  amberLight: "#00aeff",
  amberDark: "#0076d1",
  red: "#f31d77",
  green: "#00d984",
  orange: "#f5a623",
  purple: "#b48cff",
  amberGlow: "rgba(24, 136, 239, 0.15)",
  borderAmber: "rgba(24, 136, 239, 0.35)",
};

// Neutros editables por tema. hex → color picker; overlays (alpha) → texto.
const NEUTRAL_HEX_KEYS = [
  "bgDark",
  "bgCard",
  "bgElevated",
  "bgHover",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "border",
  "borderStrong",
];
const NEUTRAL_ALPHA_KEYS = ["overlaySoft", "overlayMedium", "overlayStrong"];
const NEUTRAL_DEFAULTS_DARK = {
  bgDark: "#0a0d15",
  bgCard: "#151c28",
  bgElevated: "#232a39",
  bgHover: "#323a48",
  textPrimary: "#ffffff",
  textSecondary: "#a8b4cc",
  textMuted: "#8a8d90",
  border: "#1e2a3d",
  borderStrong: "#2a3a55",
  overlaySoft: "rgba(255, 255, 255, 0.06)",
  overlayMedium: "rgba(255, 255, 255, 0.12)",
  overlayStrong: "rgba(255, 255, 255, 0.2)",
};
const NEUTRAL_DEFAULTS_LIGHT = {
  bgDark: "#f5f7fb",
  bgCard: "#ffffff",
  bgElevated: "#eef1f7",
  bgHover: "#e3e8f0",
  textPrimary: "#0a0d15",
  textSecondary: "#4a5568",
  textMuted: "#8a92a3",
  border: "#d8dde7",
  borderStrong: "#b9c3d4",
  overlaySoft: "rgba(15, 23, 42, 0.04)",
  overlayMedium: "rgba(15, 23, 42, 0.08)",
  overlayStrong: "rgba(15, 23, 42, 0.16)",
};

function CommunityEditor({
  community,
  sectionKeys,
  onSave,
  onToggleSection,
  onChanged,
}) {
  const { t } = useTranslation();
  const { addToast } = useNotifications();
  const neutralLabel = (k) => t(`admin:communities.neutralLabels.${k}`);
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description || "");
  const [slug, setSlug] = useState(community.slug);
  const [joinPolicy, setJoinPolicy] = useState(community.joinPolicy);
  const [inviteCode, setInviteCode] = useState("");
  // Toggle del subdominio single-tenant. Se guarda al instante (como las
  // secciones), por eso lleva estado local optimista.
  const [subdomainEnabled, setSubdomainEnabled] = useState(
    !!community.subdomainEnabled,
  );
  const sections = community.sections || {};
  const tenantDomain = import.meta.env.VITE_TENANT_DOMAIN || "tudominio.com";

  // ── Skin ──
  // `onAmber` (texto sobre botones/badges de fondo de acento) se guarda dentro
  // de `accents`: cssVarName lo mapea a `--on-amber`. Default blanco = el de
  // index.css, así "guardar sin tocar" no cambia nada.
  const [accents, setAccents] = useState(() => ({
    ...ACCENT_DEFAULTS,
    onAmber: "#ffffff",
    ...(community.skin?.accents || {}),
  }));
  const [brandName, setBrandName] = useState(community.skin?.brandName || "");
  const [tagline, setTagline] = useState(community.skin?.tagline || "");
  const [neutralsDark, setNeutralsDark] = useState(() => ({
    ...NEUTRAL_DEFAULTS_DARK,
    ...(community.skin?.neutralsDark || {}),
  }));
  const [neutralsLight, setNeutralsLight] = useState(() => ({
    ...NEUTRAL_DEFAULTS_LIGHT,
    ...(community.skin?.neutralsLight || {}),
  }));

  const saveSkin = async () => {
    try {
      await axios.put(API.comunidades.SKIN(community.slug), {
        accents,
        neutralsDark,
        neutralsLight,
        brandName,
        tagline,
      });
      addToast({
        type: "success",
        message: t("admin:communities.editor.toastSkinSaved"),
      });
      onChanged?.();
    } catch (err) {
      addToast({
        type: "error",
        message: errMsg(err, t("admin:communities.editor.toastSkinError")),
      });
    }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("logo", file);
    fd.append("variant", "light");
    try {
      await axios.post(API.comunidades.LOGO(community.slug), fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      addToast({
        type: "success",
        message: t("admin:communities.editor.toastLogoUploaded"),
      });
      onChanged?.();
    } catch (err) {
      addToast({
        type: "error",
        message: errMsg(err, t("admin:communities.editor.toastLogoError")),
      });
    }
  };

  return (
    <div className={styles.editor}>
      <input
        className={styles.input}
        value={name}
        aria-label={t("admin:communities.editor.nameAria")}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className={styles.input}
        value={description}
        placeholder={t("admin:communities.editor.descPlaceholder")}
        aria-label={t("admin:communities.editor.descAria")}
        onChange={(e) => setDescription(e.target.value)}
      />
      {!community.isBase && (
        <>
          <input
            className={styles.input}
            value={slug}
            placeholder={t("admin:communities.editor.slugPlaceholder")}
            aria-label={t("admin:communities.editor.slugAria")}
            onChange={(e) => setSlug(e.target.value)}
          />
          <p className={styles.muted}>
            <Trans
              i18nKey="admin:communities.editor.slugHelp"
              components={{ strong: <strong /> }}
              values={{
                slug: (slug || "").trim() || community.slug,
                domain: tenantDomain,
              }}
            />
          </p>
        </>
      )}
      <select
        className={styles.input}
        value={joinPolicy}
        aria-label={t("admin:communities.editor.policyAria")}
        onChange={(e) => setJoinPolicy(e.target.value)}
      >
        {POLICY_VALUES.map((p) => (
          <option key={p} value={p}>
            {t(`admin:communities.policies.${p}`)}
          </option>
        ))}
      </select>
      {joinPolicy === "code" && (
        <input
          className={styles.input}
          placeholder={t("admin:communities.editor.codePlaceholder")}
          aria-label={t("admin:communities.editor.codeAria")}
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
      )}
      <button
        type="button"
        className={styles.btn}
        onClick={() =>
          onSave({
            name,
            description,
            joinPolicy,
            ...(community.isBase ? {} : { slug }),
            ...(joinPolicy === "code" && inviteCode ? { inviteCode } : {}),
          })
        }
      >
        {t("admin:communities.editor.saveData")}
      </button>

      {!community.isBase && (
        <div className={styles.sections}>
          <span className={styles.sectionsLabel}>
            {t("admin:communities.editor.subdomain")}
          </span>
          <label className={styles.sectionToggle}>
            <input
              type="checkbox"
              checked={subdomainEnabled}
              onChange={(e) => {
                setSubdomainEnabled(e.target.checked);
                onSave({ subdomainEnabled: e.target.checked });
              }}
            />
            {t("admin:communities.editor.subdomainToggle")}
          </label>
          {subdomainEnabled && (
            <p className={styles.muted}>
              <Trans
                i18nKey="admin:communities.editor.subdomainHelp"
                components={{ strong: <strong /> }}
                values={{ slug: community.slug, domain: tenantDomain }}
              />
            </p>
          )}
        </div>
      )}

      <div className={styles.sections}>
        <span className={styles.sectionsLabel}>
          {t("admin:communities.editor.visibleSections")}
        </span>
        {sectionKeys
          .filter((k) => k !== "comunidades")
          .map((k) => (
            <label key={k} className={styles.sectionToggle}>
              <input
                type="checkbox"
                checked={sections[k] !== false}
                onChange={(e) => onToggleSection(k, e.target.checked)}
              />
              {k}
            </label>
          ))}
      </div>

      <div className={styles.skin}>
        <span className={styles.sectionsLabel}>
          {t("admin:communities.editor.skinTitle")}
        </span>
        {community.isBase ? (
          <p className={styles.muted}>
            {t("admin:communities.editor.skinBaseNote")}
          </p>
        ) : (
          <>
            <div className={styles.neutralsRow}>
              <span className={styles.neutralsLabel}>
                {t("admin:communities.editor.accents")}
              </span>
              {ACCENT_HEX_KEYS.map((k) => (
                <label key={k} className={styles.colorField}>
                  <input
                    type="color"
                    value={accents[k]}
                    aria-label={t("admin:communities.editor.colorOf", {
                      key: k,
                    })}
                    onChange={(e) =>
                      setAccents((a) => ({ ...a, [k]: e.target.value }))
                    }
                  />
                  {k}
                </label>
              ))}
            </div>

            <div className={styles.neutralsRow}>
              <span className={styles.neutralsLabel}>
                {t("admin:communities.editor.accentsAlpha")}
              </span>
              {ACCENT_ALPHA_KEYS.map((k) => (
                <label key={k} className={styles.colorField}>
                  <input
                    type="text"
                    className={styles.tokenText}
                    value={accents[k]}
                    aria-label={t("admin:communities.editor.colorOf", {
                      key: k,
                    })}
                    aria-invalid={
                      !COLOR_RE.test(String(accents[k] ?? "").trim())
                    }
                    placeholder="rgba(…)"
                    onChange={(e) =>
                      setAccents((a) => ({ ...a, [k]: e.target.value }))
                    }
                  />
                  {k}
                </label>
              ))}
            </div>

            <div className={styles.neutralsRow}>
              <span className={styles.neutralsLabel}>
                {t("admin:communities.editor.textOnPrimary")}
              </span>
              <label className={styles.colorField}>
                <input
                  type="color"
                  value={accents.onAmber}
                  aria-label={t(
                    "admin:communities.editor.textOnPrimaryBtnAria",
                  )}
                  onChange={(e) =>
                    setAccents((a) => ({ ...a, onAmber: e.target.value }))
                  }
                />
                {t("admin:communities.editor.textOnButtons")}
              </label>
            </div>

            <div className={styles.neutralsRow}>
              <span className={styles.neutralsLabel}>
                {t("admin:communities.editor.neutralsDark")}
              </span>
              {NEUTRAL_HEX_KEYS.map((k) => (
                <label key={`d-${k}`} className={styles.colorField}>
                  <input
                    type="color"
                    value={neutralsDark[k]}
                    aria-label={t("admin:communities.editor.neutralDarkAria", {
                      label: neutralLabel(k),
                    })}
                    onChange={(e) =>
                      setNeutralsDark((n) => ({ ...n, [k]: e.target.value }))
                    }
                  />
                  {neutralLabel(k)}
                </label>
              ))}
              {NEUTRAL_ALPHA_KEYS.map((k) => (
                <label key={`d-${k}`} className={styles.colorField}>
                  <input
                    type="text"
                    className={styles.tokenText}
                    value={neutralsDark[k]}
                    aria-label={t("admin:communities.editor.neutralDarkAria", {
                      label: neutralLabel(k),
                    })}
                    aria-invalid={
                      !COLOR_RE.test(String(neutralsDark[k] ?? "").trim())
                    }
                    placeholder="rgba(…)"
                    onChange={(e) =>
                      setNeutralsDark((n) => ({ ...n, [k]: e.target.value }))
                    }
                  />
                  {neutralLabel(k)}
                </label>
              ))}
            </div>
            <div className={styles.neutralsRow}>
              <span className={styles.neutralsLabel}>
                {t("admin:communities.editor.neutralsLight")}
              </span>
              {NEUTRAL_HEX_KEYS.map((k) => (
                <label key={`l-${k}`} className={styles.colorField}>
                  <input
                    type="color"
                    value={neutralsLight[k]}
                    aria-label={t("admin:communities.editor.neutralLightAria", {
                      label: neutralLabel(k),
                    })}
                    onChange={(e) =>
                      setNeutralsLight((n) => ({ ...n, [k]: e.target.value }))
                    }
                  />
                  {neutralLabel(k)}
                </label>
              ))}
              {NEUTRAL_ALPHA_KEYS.map((k) => (
                <label key={`l-${k}`} className={styles.colorField}>
                  <input
                    type="text"
                    className={styles.tokenText}
                    value={neutralsLight[k]}
                    aria-label={t("admin:communities.editor.neutralLightAria", {
                      label: neutralLabel(k),
                    })}
                    aria-invalid={
                      !COLOR_RE.test(String(neutralsLight[k] ?? "").trim())
                    }
                    placeholder="rgba(…)"
                    onChange={(e) =>
                      setNeutralsLight((n) => ({ ...n, [k]: e.target.value }))
                    }
                  />
                  {neutralLabel(k)}
                </label>
              ))}
            </div>

            <input
              className={styles.input}
              placeholder={t("admin:communities.editor.brandNamePlaceholder")}
              aria-label={t("admin:communities.editor.brandNameAria")}
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
            <input
              className={styles.input}
              placeholder={t("admin:communities.editor.taglinePlaceholder")}
              aria-label={t("admin:communities.editor.taglineAria")}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
            <button type="button" className={styles.btn} onClick={saveSkin}>
              {t("admin:communities.editor.saveSkin")}
            </button>
            <label className={styles.btn}>
              {t("admin:communities.editor.uploadLogo")}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={uploadLogo}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

export default function CommunitiesAdmin() {
  const { t } = useTranslation();
  const { SECTION_KEYS } = useSiteConfig();
  const { addToast } = useNotifications();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    joinPolicy: "open",
    inviteCode: "",
  });

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(API.comunidades.LIST);
      setCommunities(data.comunidades || []);
    } catch {
      addToast({
        type: "error",
        message: t("admin:communities.toastLoadError"),
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast({ type: "error", message: t("admin:communities.toastNeedName") });
      return;
    }
    try {
      await axios.post(API.comunidades.LIST, form);
      addToast({ type: "success", message: t("admin:communities.toastCreated") });
      setForm({
        name: "",
        description: "",
        joinPolicy: "open",
        inviteCode: "",
      });
      await load();
    } catch (err) {
      addToast({
        type: "error",
        message: errMsg(err, t("admin:communities.toastCreateError")),
      });
    }
  };

  const handleDelete = async (c) => {
    try {
      await axios.delete(API.comunidades.DETAIL(c.slug));
      addToast({ type: "success", message: t("admin:communities.toastDeleted") });
      await load();
    } catch (err) {
      addToast({
        type: "error",
        message:
          err.response?.status === 409
            ? t("admin:communities.toastDeleteConflict")
            : errMsg(err, t("admin:communities.toastDeleteError")),
      });
    }
  };

  const handleReassign = async (c) => {
    try {
      await axios.post(API.comunidades.REASSIGN_TO_BASE(c.slug));
      addToast({
        type: "success",
        message: t("admin:communities.toastReassigned"),
      });
      await load();
    } catch (err) {
      addToast({
        type: "error",
        message: errMsg(err, t("admin:communities.toastReassignError")),
      });
    }
  };

  const saveEdit = async (c, patch) => {
    try {
      await axios.put(API.comunidades.DETAIL(c.slug), patch);
      addToast({ type: "success", message: t("admin:communities.toastSaved") });
      await load();
    } catch (err) {
      addToast({
        type: "error",
        message: errMsg(err, t("admin:communities.toastSaveError")),
      });
    }
  };

  return (
    <section className={styles.wrap}>
      <h2 className={styles.heading}>{t("admin:communities.heading")}</h2>

      <form onSubmit={handleCreate} className={styles.createForm}>
        <input
          className={styles.input}
          placeholder={t("admin:communities.namePlaceholder")}
          aria-label={t("admin:communities.nameAria")}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          className={styles.input}
          placeholder={t("admin:communities.descPlaceholder")}
          aria-label={t("admin:communities.descAria")}
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
        />
        <select
          className={styles.input}
          aria-label={t("admin:communities.policyAria")}
          value={form.joinPolicy}
          onChange={(e) =>
            setForm((f) => ({ ...f, joinPolicy: e.target.value }))
          }
        >
          {POLICY_VALUES.map((p) => (
            <option key={p} value={p}>
              {t(`admin:communities.policies.${p}`)}
            </option>
          ))}
        </select>
        {form.joinPolicy === "code" && (
          <input
            className={styles.input}
            placeholder={t("admin:communities.codePlaceholder")}
            aria-label={t("admin:communities.codeAria")}
            value={form.inviteCode}
            onChange={(e) =>
              setForm((f) => ({ ...f, inviteCode: e.target.value }))
            }
          />
        )}
        <button type="submit" className={styles.createBtn}>
          {t("admin:communities.create")}
        </button>
      </form>

      {loading ? (
        <p className={styles.muted}>{t("admin:communities.loading")}</p>
      ) : (
        <ul className={styles.list}>
          {communities.map((c) => (
            <li key={c.slug} className={styles.row}>
              <div className={styles.rowHead}>
                <span className={styles.name}>
                  {c.name}
                  {c.isBase && (
                    <span className={styles.base}>
                      {t("admin:communities.base")}
                    </span>
                  )}
                </span>
                <span className={styles.count}>{c.slug}</span>
                <span className={styles.count}>
                  {t("admin:communities.membersCount", {
                    count: c.memberCount,
                  })}
                </span>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() =>
                      setEditing(editing === c.slug ? null : c.slug)
                    }
                  >
                    {editing === c.slug
                      ? t("admin:communities.close")
                      : t("admin:communities.edit")}
                  </button>
                  {!c.isBase && (
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => handleReassign(c)}
                    >
                      {t("admin:communities.emptyToBase")}
                    </button>
                  )}
                  {!c.isBase && (
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={() => handleDelete(c)}
                    >
                      {t("admin:communities.delete")}
                    </button>
                  )}
                </div>
              </div>
              {editing === c.slug && (
                <CommunityEditor
                  community={c}
                  sectionKeys={SECTION_KEYS}
                  onSave={(patch) => saveEdit(c, patch)}
                  onToggleSection={(k, v) =>
                    saveEdit(c, { sections: { [k]: v } })
                  }
                  onChanged={load}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
