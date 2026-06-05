import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import styles from "./BgWatchComunidad.module.css";

// Sección "Compañeros" embebida en el perfil de BG Watch: con quién jugó más
// este usuario. Cada chip linkea al head-to-head entre el dueño del perfil y
// ese compañero. Se oculta sola si no hay compañeros (o falla la carga).
export default function ComunidadCompaneros({ bggUsername }) {
  const [coPlayers, setCoPlayers] = useState(null);

  useEffect(() => {
    if (!bggUsername) return undefined;
    const ac = new AbortController();
    setCoPlayers(null);
    axios
      .get(API.bgg.COMUNIDAD_COMPANEROS(bggUsername), { signal: ac.signal })
      .then(({ data }) => setCoPlayers(data.coPlayers || []))
      .catch((err) => {
        if (!axios.isCancel(err)) setCoPlayers([]);
      });
    return () => ac.abort();
  }, [bggUsername]);

  if (!coPlayers || coPlayers.length === 0) return null;

  return (
    <section className={styles.companerosBox}>
      <h2 className={styles.sectionTitle}>Con quién juega más</h2>
      <div className={styles.ownerList}>
        {coPlayers.map((c) => {
          const label = c.user ? getUserDisplay(c.user).name : c.name;
          const chipInner = (
            <>
              {c.user ? (
                <Avatar user={c.user} size="xs" />
              ) : (
                <span className={styles.lbDot} aria-hidden="true" />
              )}
              {label}
              <span className={styles.companeroCount}>{c.numPlays}</span>
            </>
          );
          // Solo los compañeros con username BGG tienen head-to-head.
          return c.username ? (
            <Link
              key={c.username}
              to={`/bg-watch/comunidad/h2h/${encodeURIComponent(bggUsername)}/${encodeURIComponent(c.username)}`}
              className={styles.ownerChip}
            >
              {chipInner}
            </Link>
          ) : (
            <span key={`name-${label}`} className={styles.ownerChip}>
              {chipInner}
            </span>
          );
        })}
      </div>
    </section>
  );
}
