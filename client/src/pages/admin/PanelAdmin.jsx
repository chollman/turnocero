import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import styles from "./PanelAdmin.module.css";

const SECTION_META = [
  {
    group: "Contenido principal",
    items: [
      {
        key: "compartidas",
        label: "Compartidas",
        desc: "Posts sociales con fotos, comentarios y likes.",
        affects: [
          "Oculta /compartidas, /",
          "Oculta links/widgets a compartidas en perfiles",
          "Bloquea notificaciones (comentario, like)",
        ],
      },
      {
        key: "noticias",
        label: "Noticias",
        desc: "Anuncios administrativos publicados por el equipo.",
        affects: ["Oculta /noticias", 'Bloquea toasts de "noticia publicada"'],
      },
      {
        key: "eventos",
        label: "Eventos",
        desc: "Eventos con inscripciones y comprobantes.",
        affects: ["Oculta /eventos y subrutas"],
      },
      {
        key: "torneos",
        label: "Torneos",
        desc: "Torneos en formato liga, eliminación simple o grupos.",
        affects: [
          "Oculta /torneos y subrutas",
          "Bloquea notificaciones (aceptado, eliminado, avanzado, etc.)",
        ],
      },
      {
        key: "mesas",
        label: "Mesas",
        desc: "Mesas para organizar partidas (con chat, comentarios, fotos).",
        affects: [
          "Oculta /mesas",
          "Oculta widget de mesa dentro de compartidas (linkedTable)",
          "Oculta stats de mesas en perfiles",
          "Bloquea notificaciones de chat, comentarios, joins, etc.",
        ],
      },
      {
        key: "miFeed",
        label: "Mi Feed",
        desc: "Feed personal del usuario con sus propias mesas.",
        affects: ["Oculta /mi"],
      },
    ],
  },
  {
    group: "Social",
    items: [
      {
        key: "comunidad",
        label: "Comunidad",
        desc: "Listado y perfiles públicos de usuarios.",
        affects: ["Oculta /usuarios y /usuarios/:id"],
      },
      {
        key: "amigos",
        label: "Amigos",
        desc: "Sistema de solicitudes y lista de amigos.",
        affects: [
          'Oculta botón "Agregar amigo" en perfiles',
          "Bloquea notificaciones de solicitud / aceptación",
        ],
      },
      {
        key: "dms",
        label: "Mensajes Directos",
        desc: "Chat 1-a-1 entre amigos.",
        affects: [
          "Oculta /mensajes y /mensajes/:userId",
          "Oculta el FAB de chat (desktop)",
          "Oculta el icono de mensajes en la barra mobile",
          "Oculta ventanas flotantes de chat",
          "Bloquea notificaciones de DM",
        ],
      },
    ],
  },
  {
    group: "Integraciones",
    items: [
      {
        key: "bgwatch",
        label: "BG Watch",
        desc: "Integración con BoardGameGeek (perfil, partidas, colección).",
        affects: [
          "Oculta /bg-watch",
          "Oculta el badge/banner BG Watch en perfiles",
          "Oculta link al BG Watch del autor en compartidas",
          'Oculta sección "Conexión con BGG" en /perfil',
        ],
      },
      {
        key: "utilidades",
        label: "Utilidades",
        desc: "Herramientas auxiliares (dado, temporizador, selector de dedos).",
        affects: ["Oculta /utilidades y subrutas"],
      },
    ],
  },
];

function SectionToggle({ section, enabled, busy, onToggle }) {
  return (
    <div
      className={`${styles.sectionCard} ${enabled ? styles.sectionCardOn : styles.sectionCardOff}`}
    >
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleBlock}>
          <span className={styles.sectionLabel}>{section.label}</span>
          <span className={styles.sectionKey}>{section.key}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${enabled ? "Desactivar" : "Activar"} ${section.label}`}
          className={`${styles.toggle} ${enabled ? styles.toggleOn : ""}`}
          disabled={busy}
          onClick={() => onToggle(section.key, !enabled)}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>
      <p className={styles.sectionDesc}>{section.desc}</p>
      <div className={styles.affects}>
        <span className={styles.affectsLabel}>
          {enabled ? "Si la apagás:" : "Mientras esté apagada:"}
        </span>
        <ul className={styles.affectsList}>
          {section.affects.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PanelAdminInner() {
  const { sections, loaded, updatedAt, updateConfig } = useSiteConfig();
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState("");

  const handleToggle = async (key, nextEnabled) => {
    setBusyKey(key);
    setError("");
    try {
      await updateConfig({ [key]: { enabled: nextEnabled } });
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo actualizar");
    } finally {
      setBusyKey(null);
    }
  };

  if (!loaded) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.hero}>
            <div className={styles.eyebrow}>◆ ADMIN</div>
            <h1 className={styles.title}>Panel de secciones</h1>
            <p className={styles.sub}>Cargando configuración…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}>◆ ADMIN</div>
          <h1 className={styles.title}>Panel de secciones</h1>
          <p className={styles.sub}>
            Prendé o apagá secciones del sitio para usuarios no-admin. Vos
            seguís viendo todo (salvo que actives <em>"Ver como usuario"</em>).
            Los cambios se reflejan en tiempo real para todos los clientes
            conectados.
          </p>
          {updatedAt && (
            <span className={styles.updatedAt}>
              Última actualización:{" "}
              {new Date(updatedAt).toLocaleString("es-AR", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {SECTION_META.map((group) => (
          <div key={group.group} className={styles.group}>
            <h2 className={styles.groupTitle}>{group.group}</h2>
            <div className={styles.grid}>
              {group.items.map((item) => (
                <SectionToggle
                  key={item.key}
                  section={item}
                  enabled={sections?.[item.key]?.enabled !== false}
                  busy={busyKey === item.key}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PanelAdmin() {
  const { user, isActuallyAdmin, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isActuallyAdmin) return <Navigate to="/" replace />;
  return <PanelAdminInner />;
}
