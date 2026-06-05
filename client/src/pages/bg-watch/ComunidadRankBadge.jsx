import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import styles from "./BgWatchComunidad.module.css";

// Insight personal embebido en la vista per-game: "Sos el #X de Y en la
// comunidad". Se oculta si el usuario no tiene partidas de ese juego o si está
// solo (total <= 1, no hay con quién comparar).
export default function ComunidadRankBadge({ bggUsername, gameId }) {
  const [rank, setRank] = useState(null);

  useEffect(() => {
    if (!bggUsername || !gameId) return undefined;
    const ac = new AbortController();
    setRank(null);
    axios
      .get(API.bgg.COMUNIDAD_RANK(bggUsername, gameId), { signal: ac.signal })
      .then(({ data }) => setRank(data.rank))
      .catch((err) => {
        if (!axios.isCancel(err)) setRank(null);
      });
    return () => ac.abort();
  }, [bggUsername, gameId]);

  if (!rank || rank.total <= 1) return null;

  return (
    <Link
      to={`/bg-watch/comunidad/juego/${gameId}`}
      className={styles.rankBadge}
    >
      <span className={styles.rankBadgeNum}>#{rank.rank}</span>
      <span>
        de {rank.total} en la comunidad{" "}
        <span className={styles.rankBadgeMuted}>· ver juego</span>
      </span>
    </Link>
  );
}
