import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Dado.module.css';

const DICE = [4, 6, 8, 10, 12, 20];

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

export default function Dado() {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const [sides, setSides] = useState(6);
  const [count, setCount] = useState(1);
  const [results, setResults] = useState(null);
  const [rolling, setRolling] = useState(false);

  function doRoll() {
    if (rolling) return;
    setRolling(true);
    setResults(null);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const rolled = Array.from({ length: count }, () => rollDie(sides));
      setResults(rolled);
      setRolling(false);
      navigator.vibrate?.(80);
    }, 650);
  }

  function changeSides(d) {
    setSides(d);
    setResults(null);
  }

  function changeCount(delta) {
    setCount(c => Math.min(5, Math.max(1, c + delta)));
    setResults(null);
  }

  const total = results ? results.reduce((a, b) => a + b, 0) : 0;
  const isCritical = results && results.every(r => r === sides);
  const isPifia = results && results.every(r => r === 1);

  return (
    <div className={styles.screen}>
      <button className={styles.backBtn} onClick={() => navigate('/utilidades')} type="button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>

      <div className={styles.content}>
        <h2 className={styles.title}>Dado</h2>

        <div className={styles.typeRow}>
          {DICE.map(d => (
            <button
              key={d}
              className={`${styles.typeBtn} ${sides === d ? styles.typeBtnActive : ''}`}
              onClick={() => changeSides(d)}
              type="button"
            >
              d{d}
            </button>
          ))}
        </div>

        <div className={styles.countRow}>
          <button className={styles.countBtn} onClick={() => changeCount(-1)} disabled={count <= 1} type="button">−</button>
          <span className={styles.countLabel}>{count} {count === 1 ? 'dado' : 'dados'}</span>
          <button className={styles.countBtn} onClick={() => changeCount(1)} disabled={count >= 5} type="button">+</button>
        </div>

        <div className={styles.resultsArea}>
          {rolling && (
            <div className={styles.rollingWrap}>
              <span className={styles.rollingIcon}>🎲</span>
            </div>
          )}
          {!rolling && results && (
            <div className={styles.resultsWrap}>
              <div className={styles.diceRow}>
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={`${styles.die} ${r === sides ? styles.dieMax : ''} ${r === 1 ? styles.dieMin : ''}`}
                  >
                    {r}
                  </div>
                ))}
              </div>
              {count > 1 && (
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>Total</span>
                  <span className={styles.totalValue}>{total}</span>
                </div>
              )}
              {(isCritical || isPifia) && (
                <div className={`${styles.badge} ${isCritical ? styles.badgeCritical : styles.badgePifia}`}>
                  {isCritical ? '¡Crítico!' : 'Pifia'}
                </div>
              )}
            </div>
          )}
          {!rolling && !results && (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>🎲</div>
              <p className={styles.placeholderText}>d{sides} · {count === 1 ? '1 dado' : `${count} dados`}</p>
            </div>
          )}
        </div>

        <button className={styles.rollBtn} onClick={doRoll} disabled={rolling} type="button">
          {rolling ? 'Tirando…' : 'Tirar'}
        </button>
      </div>
    </div>
  );
}
