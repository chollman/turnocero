import { Fragment } from "react";
import { useTranslation, Trans } from "react-i18next";
import Avatar from "../../../components/shared/Avatar";
import { getUserDisplay } from "../../../utils/userDisplay";
import styles from "../MathTradeDetail.module.css";

// Dibuja un ciclo de intercambio: cada miembro entrega su juego y recibe el
// del siguiente. `cycle.items` viene en orden de "recibe": item[i] recibe el
// juego de item[i+1].
export default function ChainVisualizer({ cycle, highlightUserId }) {
  const { t } = useTranslation();
  if (!cycle?.items?.length) return null;
  return (
    <div className={styles.chain}>
      <div className={styles.chainTitle}>
        {t("mathtrade:chain.title", { count: cycle.length })}
      </div>
      {cycle.items.map((node, i) => {
        const display = getUserDisplay(node.owner);
        const isYou =
          highlightUserId &&
          String(node.owner?._id || node.owner) === String(highlightUserId);
        const give =
          node.gameName || t("mathtrade:chain.gameFallback", { id: node.gameId });
        const receives =
          node.receivesGameName ||
          t("mathtrade:chain.gameFallback", { id: node.receivesGameId });
        return (
          <Fragment key={node.itemId}>
            <div
              className={styles.chainMember}
              style={isYou ? { fontWeight: 600 } : undefined}
            >
              <Avatar user={node.owner} size="sm" />
              <div>
                <div className={styles.chainName}>
                  {display.name}
                  {isYou ? t("mathtrade:chain.you") : ""}
                </div>
                <div className={styles.chainGive}>
                  <Trans
                    i18nKey="mathtrade:chain.giveReceive"
                    values={{ give, receives }}
                    components={{
                      strong: <strong />,
                      arrow: <span className={styles.chainArrow} />,
                    }}
                  />
                </div>
              </div>
            </div>
            {i < cycle.items.length - 1 && (
              <div className={styles.chainConnector} aria-hidden="true" />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
