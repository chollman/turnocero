import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import { API } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useCommunity } from "../../context/CommunityContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";
import styles from "./Comunidades.module.css";

function policyLabel(p) {
  if (p === "open") return "Abierta";
  if (p === "approval") return "Por aprobación";
  return "Por código";
}

// Orden mine-first: miembro → pendiente → resto; dentro de cada grupo, base
// primero y luego alfabético.
function statusRank(c) {
  if (c.viewerStatus === "member") return 0;
  if (c.viewerStatus === "pending") return 1;
  return 2;
}

export default function Comunidades() {
  const { user } = useAuth();
  const { joinCommunity, leaveCommunity, memberships } = useCommunity();
  const { isSectionEnabled } = useSiteConfig();
  const { addToast } = useNotifications();

  // Subadmin de esta comunidad o admin global → puede gestionarla.
  const canManage = (c) =>
    !!user?.isAdmin ||
    (memberships || []).some(
      (m) => m.community.slug === c.slug && m.role === "subadmin",
    );

  // ¿Puede ver los miembros? Solo miembros (admin bypassea), con la sección
  // `comunidad` habilitada globalmente Y en esa comunidad.
  const canViewMembers = (c) => {
    if (user?.isAdmin) return true;
    if (c.viewerStatus !== "member") return false;
    if (!isSectionEnabled("comunidad")) return false;
    return c.sections?.comunidad !== false;
  };
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState({});
  const [busy, setBusy] = useState(null);
  // Comunidad pendiente de confirmación de salida (abre el modal).
  const [leaveTarget, setLeaveTarget] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(
    async (signal) => {
      try {
        const { data } = await axios.get(API.comunidades.LIST, { signal });
        setCommunities(data.comunidades || []);
      } catch (err) {
        if (!axios.isCancel(err)) {
          addToast({
            type: "error",
            message: "No pudimos cargar las comunidades",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  // Mine-first: las comunidades que integro arriba (luego pendientes, luego el
  // resto). Estable: base primero y alfabético dentro de cada grupo.
  const sortedCommunities = useMemo(() => {
    return [...communities].sort((a, b) => {
      const rank = statusRank(a) - statusRank(b);
      if (rank !== 0) return rank;
      if (a.isBase !== b.isBase) return a.isBase ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "", "es", {
        sensitivity: "base",
      });
    });
  }, [communities]);

  const handleJoin = async (community) => {
    setBusy(community.slug);
    try {
      const res = await joinCommunity(community.slug, codes[community.slug]);
      addToast({
        type: "success",
        message:
          res.status === "pending"
            ? "Solicitud enviada — un moderador la revisará"
            : `Te uniste a ${community.name}`,
      });
      await load();
    } catch (err) {
      addToast({
        type: "error",
        message: err.response?.data?.message || "No pudimos completar la acción",
      });
    } finally {
      setBusy(null);
    }
  };

  // Confirma la salida de `leaveTarget` (disparado desde el modal).
  const confirmLeave = async () => {
    if (!leaveTarget) return;
    setLeaving(true);
    try {
      await leaveCommunity(leaveTarget.slug);
      addToast({ type: "success", message: `Saliste de ${leaveTarget.name}` });
      setLeaveTarget(null);
      await load();
    } catch (err) {
      addToast({
        type: "error",
        message: err.response?.data?.message || "No pudimos completar la acción",
      });
    } finally {
      setLeaving(false);
    }
  };

  const renderAction = (c) => {
    if (!user) {
      return <span className={styles.muted}>Iniciá sesión para unirte</span>;
    }
    if (c.viewerStatus === "member") {
      if (c.isBase) return <span className={styles.memberTag}>Miembro</span>;
      return (
        <button
          type="button"
          className={styles.leaveBtn}
          disabled={leaving}
          onClick={() => setLeaveTarget(c)}
        >
          Salir
        </button>
      );
    }
    if (c.viewerStatus === "pending") {
      return <span className={styles.pendingTag}>Solicitud pendiente</span>;
    }
    return (
      <div className={styles.joinRow}>
        {c.joinPolicy === "code" && (
          <input
            className={styles.codeInput}
            placeholder="Código"
            aria-label={`Código para ${c.name}`}
            value={codes[c.slug] || ""}
            onChange={(e) =>
              setCodes((s) => ({ ...s, [c.slug]: e.target.value }))
            }
          />
        )}
        <button
          type="button"
          className={styles.joinBtn}
          disabled={busy === c.slug}
          onClick={() => handleJoin(c)}
        >
          {c.joinPolicy === "approval" ? "Solicitar unirme" : "Unirme"}
        </button>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.eyebrow}>MIS COMUNIDADES</div>
        <h1 className={styles.title}>Mis Comunidades</h1>
        <p className={styles.subtitle}>
          Unite a una comunidad para ver y compartir su contenido. Podés
          integrar varias a la vez y elegir cuáles ver desde tu perfil.
        </p>
      </header>

      {loading ? (
        <p className={styles.muted}>Cargando comunidades…</p>
      ) : communities.length === 0 ? (
        <p className={styles.muted}>Todavía no hay comunidades.</p>
      ) : (
        <div className={styles.grid}>
          {sortedCommunities.map((c) => (
            <article key={c.slug} className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardName}>{c.name}</h2>
                {c.isBase && <span className={styles.baseBadge}>Base</span>}
              </div>
              {c.description && (
                <p className={styles.cardDesc}>{c.description}</p>
              )}
              <div className={styles.meta}>
                <span>
                  {c.memberCount}{" "}
                  {c.memberCount === 1 ? "miembro" : "miembros"}
                </span>
                <span className={styles.policy}>
                  {policyLabel(c.joinPolicy)}
                </span>
              </div>
              <div className={styles.action}>
                {renderAction(c)}
                <div className={styles.links}>
                  {canViewMembers(c) && (
                    <Link
                      className={styles.membersLink}
                      to={`/comunidades/${c.slug}`}
                    >
                      Ver miembros
                    </Link>
                  )}
                  {canManage(c) && (
                    <Link
                      className={styles.manageLink}
                      to={`/comunidades/${c.slug}/gestion`}
                    >
                      Gestionar
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmActionModal
        isOpen={!!leaveTarget}
        title="Salir de la comunidad"
        message={`¿Querés salir de ${leaveTarget?.name}? Vas a dejar de ver su contenido. Podés volver a unirte cuando quieras.`}
        confirmLabel="Sí, salir"
        variant="danger"
        loading={leaving}
        onConfirm={confirmLeave}
        onCancel={() => {
          if (!leaving) setLeaveTarget(null);
        }}
      />
    </div>
  );
}
