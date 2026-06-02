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

function CommunityEditor({ community, sectionKeys, onSave, onToggleSection }) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description || "");
  const [joinPolicy, setJoinPolicy] = useState(community.joinPolicy);
  const [inviteCode, setInviteCode] = useState("");
  const sections = community.sections || {};

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
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
