import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../../api/endpoints";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";
import styles from "./CommunitiesAdmin.module.css";

const POLICIES = [
  { value: "open", label: "Abierta" },
  { value: "approval", label: "Por aprobación" },
  { value: "code", label: "Por código" },
];

const errMsg = (err, fallback) => err?.response?.data?.message || fallback;

const ACCENT_DEFAULTS = {
  amber: "#1888ef",
  red: "#f31d77",
  green: "#00d984",
  orange: "#f5a623",
  purple: "#b48cff",
};
const ACCENT_KEYS = Object.keys(ACCENT_DEFAULTS);

// Neutros editables por tema (un subconjunto representativo). Los defaults son
// los valores base de index.css, así que "guardar sin tocar" no cambia nada.
const NEUTRAL_KEYS = ["bgDark", "bgCard", "textPrimary"];
const NEUTRAL_LABELS = {
  bgDark: "Fondo",
  bgCard: "Tarjeta",
  textPrimary: "Texto",
};
const NEUTRAL_DEFAULTS_DARK = {
  bgDark: "#0a0d15",
  bgCard: "#151c28",
  textPrimary: "#ffffff",
};
const NEUTRAL_DEFAULTS_LIGHT = {
  bgDark: "#f5f7fb",
  bgCard: "#ffffff",
  textPrimary: "#0a0d15",
};

function CommunityEditor({
  community,
  sectionKeys,
  onSave,
  onToggleSection,
  onChanged,
}) {
  const { addToast } = useNotifications();
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description || "");
  const [joinPolicy, setJoinPolicy] = useState(community.joinPolicy);
  const [inviteCode, setInviteCode] = useState("");
  const sections = community.sections || {};

  // ── Skin ──
  const [accents, setAccents] = useState(() => ({
    ...ACCENT_DEFAULTS,
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
      addToast({ type: "success", message: "Skin guardado" });
      onChanged?.();
    } catch (err) {
      addToast({ type: "error", message: errMsg(err, "No se pudo guardar el skin") });
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
      addToast({ type: "success", message: "Logo subido" });
      onChanged?.();
    } catch (err) {
      addToast({ type: "error", message: errMsg(err, "No se pudo subir el logo") });
    }
  };

  return (
    <div className={styles.editor}>
      <input
        className={styles.input}
        value={name}
        aria-label="Nombre"
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className={styles.input}
        value={description}
        placeholder="Descripción"
        aria-label="Descripción"
        onChange={(e) => setDescription(e.target.value)}
      />
      <select
        className={styles.input}
        value={joinPolicy}
        aria-label="Política de unión"
        onChange={(e) => setJoinPolicy(e.target.value)}
      >
        {POLICIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {joinPolicy === "code" && (
        <input
          className={styles.input}
          placeholder="Nuevo código (opcional)"
          aria-label="Código de invitación"
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
            ...(joinPolicy === "code" && inviteCode ? { inviteCode } : {}),
          })
        }
      >
        Guardar datos
      </button>

      <div className={styles.sections}>
        <span className={styles.sectionsLabel}>
          Secciones visibles para esta comunidad
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
        <span className={styles.sectionsLabel}>Skin (colores de marca)</span>
        {ACCENT_KEYS.map((k) => (
          <label key={k} className={styles.colorField}>
            <input
              type="color"
              value={accents[k]}
              aria-label={`Color ${k}`}
              onChange={(e) =>
                setAccents((a) => ({ ...a, [k]: e.target.value }))
              }
            />
            {k}
          </label>
        ))}

        <div className={styles.neutralsRow}>
          <span className={styles.neutralsLabel}>Neutros (oscuro)</span>
          {NEUTRAL_KEYS.map((k) => (
            <label key={`d-${k}`} className={styles.colorField}>
              <input
                type="color"
                value={neutralsDark[k]}
                aria-label={`${NEUTRAL_LABELS[k]} oscuro`}
                onChange={(e) =>
                  setNeutralsDark((n) => ({ ...n, [k]: e.target.value }))
                }
              />
              {NEUTRAL_LABELS[k]}
            </label>
          ))}
        </div>
        <div className={styles.neutralsRow}>
          <span className={styles.neutralsLabel}>Neutros (claro)</span>
          {NEUTRAL_KEYS.map((k) => (
            <label key={`l-${k}`} className={styles.colorField}>
              <input
                type="color"
                value={neutralsLight[k]}
                aria-label={`${NEUTRAL_LABELS[k]} claro`}
                onChange={(e) =>
                  setNeutralsLight((n) => ({ ...n, [k]: e.target.value }))
                }
              />
              {NEUTRAL_LABELS[k]}
            </label>
          ))}
        </div>

        <input
          className={styles.input}
          placeholder="Nombre de marca (opcional)"
          aria-label="Nombre de marca"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Tagline (opcional)"
          aria-label="Tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
        />
        <button type="button" className={styles.btn} onClick={saveSkin}>
          Guardar skin
        </button>
        <label className={styles.btn}>
          Subir logo
          <input type="file" accept="image/*" hidden onChange={uploadLogo} />
        </label>
      </div>
    </div>
  );
}

export default function CommunitiesAdmin() {
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
      addToast({ type: "error", message: "No pudimos cargar las comunidades" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast({ type: "error", message: "Poné un nombre" });
      return;
    }
    try {
      await axios.post(API.comunidades.LIST, form);
      addToast({ type: "success", message: "Comunidad creada" });
      setForm({ name: "", description: "", joinPolicy: "open", inviteCode: "" });
      await load();
    } catch (err) {
      addToast({ type: "error", message: errMsg(err, "No se pudo crear") });
    }
  };

  const handleDelete = async (c) => {
    try {
      await axios.delete(API.comunidades.DETAIL(c.slug));
      addToast({ type: "success", message: "Comunidad eliminada" });
      await load();
    } catch (err) {
      addToast({
        type: "error",
        message:
          err.response?.status === 409
            ? "Tiene contenido — reasignalo a la base primero."
            : errMsg(err, "No se pudo eliminar"),
      });
    }
  };

  const handleReassign = async (c) => {
    try {
      await axios.post(API.comunidades.REASSIGN_TO_BASE(c.slug));
      addToast({ type: "success", message: "Contenido reasignado a la base" });
      await load();
    } catch (err) {
      addToast({ type: "error", message: errMsg(err, "No se pudo reasignar") });
    }
  };

  const saveEdit = async (c, patch) => {
    try {
      await axios.put(API.comunidades.DETAIL(c.slug), patch);
      addToast({ type: "success", message: "Guardado" });
      await load();
    } catch (err) {
      addToast({ type: "error", message: errMsg(err, "No se pudo guardar") });
    }
  };

  return (
    <section className={styles.wrap}>
      <h2 className={styles.heading}>Comunidades</h2>

      <form onSubmit={handleCreate} className={styles.createForm}>
        <input
          className={styles.input}
          placeholder="Nombre"
          aria-label="Nombre de la comunidad"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          className={styles.input}
          placeholder="Descripción"
          aria-label="Descripción de la comunidad"
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
        />
        <select
          className={styles.input}
          aria-label="Política de unión"
          value={form.joinPolicy}
          onChange={(e) =>
            setForm((f) => ({ ...f, joinPolicy: e.target.value }))
          }
        >
          {POLICIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {form.joinPolicy === "code" && (
          <input
            className={styles.input}
            placeholder="Código"
            aria-label="Código de invitación"
            value={form.inviteCode}
            onChange={(e) =>
              setForm((f) => ({ ...f, inviteCode: e.target.value }))
            }
          />
        )}
        <button type="submit" className={styles.createBtn}>
          Crear comunidad
        </button>
      </form>

      {loading ? (
        <p className={styles.muted}>Cargando…</p>
      ) : (
        <ul className={styles.list}>
          {communities.map((c) => (
            <li key={c.slug} className={styles.row}>
              <div className={styles.rowHead}>
                <span className={styles.name}>
                  {c.name}
                  {c.isBase && <span className={styles.base}>base</span>}
                </span>
                <span className={styles.count}>{c.memberCount} miembros</span>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() =>
                      setEditing(editing === c.slug ? null : c.slug)
                    }
                  >
                    {editing === c.slug ? "Cerrar" : "Editar"}
                  </button>
                  {!c.isBase && (
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => handleReassign(c)}
                    >
                      Vaciar → base
                    </button>
                  )}
                  {!c.isBase && (
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={() => handleDelete(c)}
                    >
                      Borrar
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
