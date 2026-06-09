import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import Meeple from "../../components/shared/Meeple";
import BackButton from "../../components/shared/BackButton";
import { getUserDisplay } from "../../utils/userDisplay";
import styles from "./BgWatchComunidad.module.css";

function Side({ side, name }) {
  return (
    <div className={styles.h2hSide}>
      {side.user ? (
        <Avatar user={side.user} size="lg" />
      ) : (
        <span
          className={`${styles.lbDot} ${styles.h2hDot}`}
          aria-hidden="true"
        />
      )}
      <Link
        to={`/bg-watch/${encodeURIComponent(side.bggUsername)}`}
        className={styles.h2hName}
      >
        {name}
      </Link>
    </div>
  );
}

export default function BgWatchH2H() {
  const { userA, userB } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setData(null);
    setError(false);
    axios
      .get(API.bgg.COMUNIDAD_H2H(userA, userB), { signal: ac.signal })
      .then(({ data: d }) => setData(d))
      .catch((err) => {
        if (!axios.isCancel(err)) setError(true);
      });
    return () => ac.abort();
  }, [userA, userB]);

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.errorMsg}>No se pudo cargar el head-to-head.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.loading}>Cargando…</div>
        </div>
      </div>
    );
  }

  const nameA = data.userA.user ? getUserDisplay(data.userA.user).name : userA;
  const nameB = data.userB.user ? getUserDisplay(data.userB.user).name : userB;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <BackButton onClick={() => navigate(-1)} flush>
          Volver
        </BackButton>

        <header className={styles.hero}>
          <div className={styles.eyebrow}>
            <Meeple />
            BG WATCH · MANO A MANO
          </div>
          <h1 className={styles.heroTitle}>
            {nameA} vs {nameB}
          </h1>
          <p className={styles.heroSub}>
            {data.total === 0
              ? "Todavía no compartieron ninguna partida registrada."
              : `${data.total} ${data.total === 1 ? "partida compartida" : "partidas compartidas"}.`}
          </p>
        </header>

        {data.total > 0 && (
          <>
            <div className={styles.h2hBoard}>
              <Side side={data.userA} name={nameA} />
              <div className={styles.h2hScore}>
                <span className={styles.h2hWins}>{data.aWins}</span>
                <span className={styles.h2hDash}>–</span>
                <span className={styles.h2hWins}>{data.bWins}</span>
                {data.draws > 0 && (
                  <span className={styles.h2hDraws}>
                    {data.draws} sin decidir
                  </span>
                )}
              </div>
              <Side side={data.userB} name={nameB} />
            </div>

            {data.byGame?.length > 0 && (
              <section>
                <h2 className={styles.sectionTitle}>Por juego</h2>
                <ul className={styles.byGameList}>
                  {data.byGame.map((g) => (
                    <li key={g.gameId || g.name} className={styles.byGameRow}>
                      <span className={styles.byGameName}>
                        {g.name || `Juego ${g.gameId}`}
                      </span>
                      <span className={styles.byGameScore}>
                        {g.aWins} – {g.bWins}
                        <span className={styles.byGameTotal}>
                          {" "}
                          ({g.total} {g.total === 1 ? "partida" : "partidas"})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
