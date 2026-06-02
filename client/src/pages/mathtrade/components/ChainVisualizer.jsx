import { Fragment } from "react";
import Avatar from "../../../components/shared/Avatar";
import { getUserDisplay } from "../../../utils/userDisplay";
import styles from "../MathTradeDetail.module.css";

// Dibuja un ciclo de intercambio: cada miembro entrega su juego y recibe el
// del siguiente. `cycle.items` viene en orden de "recibe": item[i] recibe el
// juego de item[i+1].
export default function ChainVisualizer({ cycle, highlightUserId }) {
  if (!cycle?.items?.length) return null;
  return (
    <div className={styles.chain}>
      <div className={styles.chainTitle}>
        Cadena de {cycle.length} {cycle.length === 1 ? "persona" : "personas"}
      </div>
      {cycle.items.map((node, i) => {
        const display = getUserDisplay(node.owner);
        const isYou =
          highlightUserId &&
          String(node.owner?._id || node.owner) === String(highlightUserId);
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
                  {isYou ? " (vos)" : ""}
                </div>
                <div className={styles.chainGive}>
                  entrega <strong>{node.gameName || `#${node.gameId}`}</strong>{" "}
                  <span className={styles.chainArrow}>→</span> recibe{" "}
                  <strong>
                    {node.receivesGameName || `#${node.receivesGameId}`}
                  </strong>
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
