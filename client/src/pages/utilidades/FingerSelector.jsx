import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './FingerSelector.module.css';

const FINGER_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
  '#f97316', '#ec4899', '#06b6d4', '#84cc16', '#f0f0f0',
];
const COUNTDOWN_START = 3;
const MIN_FINGERS = 2;
const CIRCUMFERENCE = 2 * Math.PI * 40;

export default function FingerSelector() {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const touchMapRef = useRef(new Map());
  const phaseRef = useRef('idle');
  const countingRef = useRef(false);
  const colorIdxRef = useRef(0);
  const usedColorsRef = useRef(new Set());
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const [dots, setDots] = useState([]);
  const [phase, setPhase] = useState('idle');
  const [counting, setCounting] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [winnerId, setWinnerId] = useState(null);
  const [countKey, setCountKey] = useState(0);

  function nextColor() {
    for (let i = 0; i < FINGER_COLORS.length; i++) {
      const idx = (colorIdxRef.current + i) % FINGER_COLORS.length;
      if (!usedColorsRef.current.has(idx)) {
        usedColorsRef.current.add(idx);
        colorIdxRef.current = (idx + 1) % FINGER_COLORS.length;
        return { color: FINGER_COLORS[idx], colorIndex: idx };
      }
    }
    const idx = colorIdxRef.current % FINGER_COLORS.length;
    return { color: FINGER_COLORS[idx], colorIndex: idx };
  }

  function freeColor(colorIndex) {
    usedColorsRef.current.delete(colorIndex);
  }

  function reset() {
    clearInterval(intervalRef.current);
    clearTimeout(timeoutRef.current);
    touchMapRef.current.clear();
    usedColorsRef.current.clear();
    colorIdxRef.current = 0;
    phaseRef.current = 'idle';
    countingRef.current = false;
    setDots([]);
    setPhase('idle');
    setCounting(false);
    setCountdown(COUNTDOWN_START);
    setWinnerId(null);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function syncDots() {
      setDots([...touchMapRef.current.values()]);
    }

    function triggerSelection() {
      const active = [...touchMapRef.current.values()];
      if (active.length === 0) return;
      const winner = active[Math.floor(Math.random() * active.length)];
      phaseRef.current = 'selecting';
      setPhase('selecting');
      setWinnerId(winner.id);
      timeoutRef.current = setTimeout(() => {
        phaseRef.current = 'result';
        setPhase('result');
      }, 700);
    }

    function startCountdown() {
      if (countingRef.current) return;
      countingRef.current = true;
      setCounting(true);
      setCountdown(COUNTDOWN_START);
      setCountKey(k => k + 1);
      let count = COUNTDOWN_START;
      intervalRef.current = setInterval(() => {
        count--;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(intervalRef.current);
          countingRef.current = false;
          triggerSelection();
        }
      }, 1000);
    }

    function stopCountdown() {
      clearInterval(intervalRef.current);
      countingRef.current = false;
      setCounting(false);
      setCountdown(COUNTDOWN_START);
    }

    function onTouchStart(e) {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const p = phaseRef.current;
      if (p === 'selecting' || p === 'result') return;

      for (const touch of e.changedTouches) {
        if (!touchMapRef.current.has(touch.identifier)) {
          const { color, colorIndex } = nextColor();
          touchMapRef.current.set(touch.identifier, {
            id: touch.identifier,
            x: touch.clientX,
            y: touch.clientY,
            color,
            colorIndex,
          });
        }
      }
      syncDots();

      phaseRef.current = 'waiting';
      setPhase('waiting');

      if (touchMapRef.current.size >= MIN_FINGERS) {
        startCountdown();
      }
    }

    function onTouchMove(e) {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const p = phaseRef.current;
      if (p === 'selecting' || p === 'result') return;

      for (const touch of e.changedTouches) {
        const existing = touchMapRef.current.get(touch.identifier);
        if (existing) {
          touchMapRef.current.set(touch.identifier, {
            ...existing,
            x: touch.clientX,
            y: touch.clientY,
          });
        }
      }
      syncDots();
    }

    function onTouchEnd(e) {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const p = phaseRef.current;
      if (p === 'selecting' || p === 'result') return;

      for (const touch of e.changedTouches) {
        const dot = touchMapRef.current.get(touch.identifier);
        if (dot) {
          freeColor(dot.colorIndex);
          touchMapRef.current.delete(touch.identifier);
        }
      }
      syncDots();

      const count = touchMapRef.current.size;
      if (count < MIN_FINGERS) {
        stopCountdown();
        phaseRef.current = count === 0 ? 'idle' : 'waiting';
        setPhase(count === 0 ? 'idle' : 'waiting');
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const winnerColor = winnerId !== null ? dots.find(d => d.id === winnerId)?.color : null;

  return (
    <div ref={containerRef} className={styles.screen}>
      <button className={styles.backBtn} onClick={() => navigate('/utilidades')} type="button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>

      {phase === 'idle' && (
        <div className={styles.idle}>
          <div className={styles.idleIcon}>👆</div>
          <p className={styles.idleText}>Pongan los dedos en la pantalla</p>
          <p className={styles.idleHint}>Al menos 2 jugadores</p>
        </div>
      )}

      {phase === 'waiting' && !counting && (
        <div className={styles.waitingHint}>Necesitás al menos 2 dedos</div>
      )}

      {counting && phase === 'waiting' && (
        <div className={styles.countdown}>
          <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle
              key={countKey}
              cx="50" cy="50" r="40"
              fill="none"
              stroke="var(--amber)"
              strokeWidth="6"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={0}
              strokeLinecap="round"
              style={{ animation: `ringEmpty ${COUNTDOWN_START}s linear forwards` }}
            />
          </svg>
          <div className={styles.countdownNum}>{countdown}</div>
        </div>
      )}

      {winnerColor && (phase === 'selecting' || phase === 'result') && (
        <div className={styles.winnerOverlay} style={{ background: winnerColor }} />
      )}

      {dots.map(dot => {
        const isLoser = (phase === 'selecting' || phase === 'result') && dot.id !== winnerId;
        const isWinner = (phase === 'selecting' || phase === 'result') && dot.id === winnerId;
        return (
          <div
            key={dot.id}
            className={`${styles.dot} ${isLoser ? styles.dotLoser : ''} ${isWinner ? styles.dotWinner : ''}`}
            style={{
              left: dot.x,
              top: dot.y,
              background: `radial-gradient(circle at 40% 35%, ${dot.color}cc, ${dot.color}88)`,
              border: `3px solid ${dot.color}`,
              boxShadow: `0 0 28px ${dot.color}88`,
            }}
          >
            <div className={styles.dotInner} />
          </div>
        );
      })}

      {phase === 'result' && (
        <button className={styles.replayBtn} onClick={reset} type="button">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>
      )}
    </div>
  );
}
