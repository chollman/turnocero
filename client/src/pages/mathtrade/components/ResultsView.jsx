import { useState } from "react";
import ChainVisualizer from "./ChainVisualizer";
import UserBreakdown from "./UserBreakdown";
import styles from "../MathTradeDetail.module.css";

// Vista de resultados publicados: banner de stats + tus intercambios + el
// detalle agrupado por cadena o por usuario (toggle). `items` (lista completa
// de ítems) habilita la vista por usuario con los no-matcheados; si no viene,
// la vista por usuario se deriva de las cadenas (solo matcheados).
export default function ResultsView({ results, items, currentUserId }) {
  const [groupBy, setGroupBy] = useState("chain");
  if (!results) return null;
  const { summary, cycles = [] } = results;

  const isMine = (node) =>
    currentUserId &&
    String(node.owner?._id || node.owner) === String(currentUserId);
  const myCycles = currentUserId
    ? cycles.filter((c) => c.items.some(isMine))
    : [];

  return (
    <div>
      <div className={styles.summaryBanner}>
        <div className={styles.stat}>
          <span className={styles.statNum}>{summary?.itemsTraded ?? 0}</span>
          <span className={styles.statLabel}>juegos intercambiados</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum}>{summary?.itemsOffered ?? 0}</span>
          <span className={styles.statLabel}>juegos ofrecidos</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum}>{summary?.cyclesCount ?? 0}</span>
          <span className={styles.statLabel}>cadenas</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum}>{summary?.longestCycle ?? 0}</span>
          <span className={styles.statLabel}>cadena más larga</span>
        </div>
        {summary?.chosenChainLength != null && (
          <div className={styles.stat}>
            <span className={styles.statNum}>{summary.chosenChainLength}</span>
            <span className={styles.statLabel}>tope de cadena elegido</span>
          </div>
        )}
      </div>

      {summary?.approximate && (
        <div className={styles.approxBanner}>
          ⚠️ Resultado aproximado: la cantidad de combinaciones superó el límite
          de cálculo exacto, así que se usó una heurística. Es un resultado
          válido pero podría no ser el óptimo absoluto.
        </div>
      )}

      {myCycles.length > 0 && (
        <div className={styles.youBox}>
          <div className={styles.chainTitle}>Tus intercambios</div>
          {myCycles.map((c, i) => (
            <ChainVisualizer
              key={i}
              cycle={c}
              highlightUserId={currentUserId}
            />
          ))}
        </div>
      )}

      <div className={styles.viewToggle} role="tablist">
        <button
          role="tab"
          aria-selected={groupBy === "chain"}
          className={`${styles.viewToggleBtn} ${groupBy === "chain" ? styles.viewToggleBtnActive : ""}`}
          onClick={() => setGroupBy("chain")}
        >
          Por cadena
        </button>
        <button
          role="tab"
          aria-selected={groupBy === "user"}
          className={`${styles.viewToggleBtn} ${groupBy === "user" ? styles.viewToggleBtnActive : ""}`}
          onClick={() => setGroupBy("user")}
        >
          Por usuario
        </button>
      </div>

      {groupBy === "chain" ? (
        <>
          <h3 className={styles.sectionTitle}>
            {cycles.length === 0
              ? "No se concretó ningún intercambio"
              : `Todas las cadenas (${cycles.length})`}
          </h3>
          {cycles.map((c, i) => (
            <ChainVisualizer
              key={i}
              cycle={c}
              highlightUserId={currentUserId}
            />
          ))}
        </>
      ) : (
        <UserBreakdown
          items={items}
          cycles={cycles}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
