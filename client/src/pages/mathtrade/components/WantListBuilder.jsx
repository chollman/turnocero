import BggGameSearch from "../../../components/shared/BggGameSearch";
import styles from "../MathTradeDetail.module.css";

// Constructor de want list: agrega juegos vía BGG, los ordena por preferencia
// (el orden = rank) y permite quitarlos. `wants` es el array controlado y
// `onChange` recibe la nueva lista.
export default function WantListBuilder({ wants, onChange }) {
  const add = (g) => {
    if (wants.some((w) => w.bggGameId === g.id)) return; // ya está
    onChange([
      ...wants,
      { bggGameId: g.id, gameName: g.name, thumbnail: g.thumbnail },
    ]);
  };

  const remove = (id) => onChange(wants.filter((w) => w.bggGameId !== id));

  const move = (idx, dir) => {
    const next = [...wants];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div>
      <span className={styles.formLabel}>
        Want list (en orden de preferencia)
      </span>
      {wants.length === 0 && (
        <p className={styles.chainGive} style={{ marginBottom: 8 }}>
          Agregá los juegos que aceptarías a cambio.
        </p>
      )}
      {wants.map((w, idx) => (
        <div className={styles.wantRow} key={w.bggGameId}>
          <span className={styles.wantRank}>{idx + 1}</span>
          <span className={styles.wantName}>
            {w.gameName || `Juego #${w.bggGameId}`}
          </span>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => move(idx, -1)}
            disabled={idx === 0}
            aria-label="Subir preferencia"
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => move(idx, 1)}
            disabled={idx === wants.length - 1}
            aria-label="Bajar preferencia"
          >
            ↓
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => remove(w.bggGameId)}
            aria-label="Quitar"
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <BggGameSearch
          onPick={add}
          clearOnPick
          autoFocus={false}
          placeholder="Agregá un juego a tu want list…"
        />
      </div>
    </div>
  );
}
