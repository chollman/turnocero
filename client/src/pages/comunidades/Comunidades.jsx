import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Meeple from "../../components/shared/Meeple";
import { API } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useCommunity } from "../../context/CommunityContext";
import { useNotifications } from "../../context/NotificationContext";
import styles from "./Comunidades.module.css";

function policyLabel(p) {
  if (p === "open") return "Abierta";
  if (p === "approval") return "Por aprobación";
  return "Por código";
}

export default function Comunidades() {
  const { user } = useAuth();
  const { joinCommunity, leaveCommunity } = useCommunity();
  const { addToast } = useNotifications();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState({});
  const [busy, setBusy] = useState(null);

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

  const handleLeave = async (community) => {
    setBusy(community.slug);
    try {
      await leaveCommunity(community.slug);
      addToast({ type: "success", message: `Saliste de ${community.name}` });
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
          disabled={busy === c.slug}
          onClick={() => handleLeave(c)}
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
        <div className={styles.eyebrow}>
          <Meeple /> COMUNIDADES
        </div>
        <h1 className={styles.title}>Elegí tu comunidad</h1>
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
          {communities.map((c) => (
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
              <div className={styles.action}>{renderAction(c)}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
