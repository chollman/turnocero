import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("bgwatch");
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
          <p className={styles.errorMsg}>{t("h2h.loadError")}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.loading}>{t("common.loading")}</div>
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
          {t("common.back")}
        </BackButton>

        <header className={styles.hero}>
          <div className={styles.eyebrow}>
            <Meeple />
            {t("h2h.brand")}
          </div>
          <h1 className={styles.heroTitle}>
            {t("h2h.title", { a: nameA, b: nameB })}
          </h1>
          <p className={styles.heroSub}>
            {data.total === 0
              ? t("h2h.none")
              : t("h2h.sharedCount", { count: data.total })}
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
                    {t("h2h.undecided", { n: data.draws })}
                  </span>
                )}
              </div>
              <Side side={data.userB} name={nameB} />
            </div>

            {data.byGame?.length > 0 && (
              <section>
                <h2 className={styles.sectionTitle}>{t("h2h.byGame")}</h2>
                <ul className={styles.byGameList}>
                  {data.byGame.map((g) => (
                    <li key={g.gameId || g.name} className={styles.byGameRow}>
                      <span className={styles.byGameName}>
                        {g.name || t("h2h.gameFallback", { id: g.gameId })}
                      </span>
                      <span className={styles.byGameScore}>
                        {g.aWins} – {g.bWins}
                        <span className={styles.byGameTotal}>
                          {" "}
                          {t("h2h.gamePlays", { count: g.total })}
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
