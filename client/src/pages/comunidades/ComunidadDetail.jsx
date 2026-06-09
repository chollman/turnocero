import { useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useCommunity } from "../../context/CommunityContext";
import Meeple from "../../components/shared/Meeple";
import BackButton from "../../components/shared/BackButton";
import UsersList from "../users/UsersList";
import styles from "./ComunidadDetail.module.css";

// Detalle de una comunidad: encabezado + lista de miembros (reusa el browser
// de UsersList scopeado por `community`). Gateado por la sección `comunidad`
// (global Y per-comunidad) y restringido a miembros de la comunidad. Los
// admins globales bypassean el gate. El backend (`GET /api/users?community=`)
// reaplica el mismo gate como defensa en profundidad.
export default function ComunidadDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const { memberships } = useCommunity();
  const isAdmin = !!user?.isAdmin;

  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(false);
    axios
      .get(API.comunidades.DETAIL(slug), { signal: ac.signal })
      .then(({ data }) => setCommunity(data))
      .catch((err) => {
        if (!axios.isCancel(err)) setError(true);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [slug]);

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>Cargando comunidad…</p>
      </div>
    );
  }

  // No existe / error de carga → de vuelta al directorio.
  if (error || !community) {
    return <Navigate to="/comunidades" replace />;
  }

  // Gate (los admins bypassean estos chequeos): sección `comunidad` global on,
  // toggle de ESTA comunidad on, y el viewer es miembro.
  const isMember = community.viewerStatus === "member";
  const globalOn = isSectionEnabled("comunidad");
  const communityOn = community.sections?.comunidad !== false;
  if (!isAdmin && (!globalOn || !communityOn || !isMember)) {
    return <Navigate to="/comunidades" replace />;
  }

  const canManage =
    isAdmin ||
    (memberships || []).some(
      (m) => m.community.slug === slug && m.role === "subadmin",
    );

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <BackButton to="/comunidades">Mis Comunidades</BackButton>
        <div className={styles.eyebrow}>
          <Meeple /> COMUNIDAD
        </div>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{community.name}</h1>
          {community.isBase && <span className={styles.baseBadge}>Base</span>}
        </div>
        {community.description && (
          <p className={styles.description}>{community.description}</p>
        )}
        <div className={styles.metaRow}>
          <span className={styles.memberCount}>
            {community.memberCount}{" "}
            {community.memberCount === 1 ? "miembro" : "miembros"}
          </span>
          {canManage && (
            <Link
              to={`/comunidades/${slug}/gestion`}
              className={styles.manageLink}
            >
              Gestionar
            </Link>
          )}
        </div>
      </header>

      <UsersList communityId={community._id} />
    </div>
  );
}
