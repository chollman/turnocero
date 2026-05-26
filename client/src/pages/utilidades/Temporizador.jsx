import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Temporizador.module.css";

const PRESETS = [
  { label: "1m", seconds: 60 },
  { label: "2m", seconds: 120 },
  { label: "3m", seconds: 180 },
  { label: "5m", seconds: 300 },
  { label: "10m", seconds: 600 },
];

const R = 58;
const CIRCUMFERENCE = 2 * Math.PI * R;

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7, 1.05].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.5, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.28);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.28);
    });
  } catch {
    /* no web audio */
  }
  navigator.vibrate?.([200, 150, 200, 150, 400]);
}

export default function Temporizador() {
  const navigate = useNavigate();
  const intervalRef = useRef(null);
  const [total, setTotal] = useState(180);
  const [remaining, setRemaining] = useState(180);
  const [phase, setPhase] = useState("idle"); // idle | running | paused | done

  useEffect(() => () => clearInterval(intervalRef.current), []);

  useEffect(() => {
    if (remaining === 0 && phase === "running") {
      clearInterval(intervalRef.current);
      setPhase("done");
      playAlarm();
    }
  }, [remaining, phase]);

  function applyPreset(seconds) {
    clearInterval(intervalRef.current);
    setTotal(seconds);
    setRemaining(seconds);
    setPhase("idle");
  }

  function start() {
    setPhase("running");
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
  }

  function pause() {
    clearInterval(intervalRef.current);
    setPhase("paused");
  }

  function reset() {
    clearInterval(intervalRef.current);
    setRemaining(total);
    setPhase("idle");
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const dashOffset = CIRCUMFERENCE * (1 - (total > 0 ? remaining / total : 1));
  const isDone = phase === "done";

  return (
    <div className={`${styles.screen} ${isDone ? styles.screenDone : ""}`}>
      <button
        className={styles.backBtn}
        onClick={() => navigate("/utilidades")}
        type="button"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <div className={styles.content}>
        <div className={styles.ringWrap}>
          <svg viewBox="0 0 140 140" className={styles.ring}>
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="8"
            />
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={isDone ? "var(--red)" : "var(--amber)"}
              strokeWidth="8"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "70px 70px",
                transition:
                  phase === "running"
                    ? "stroke-dashoffset 1s linear"
                    : "stroke-dashoffset 0.3s ease",
              }}
            />
          </svg>
          <div className={styles.timeInner}>
            {isDone ? (
              <span className={styles.doneText}>¡Tiempo!</span>
            ) : (
              <span className={styles.timeText}>
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </span>
            )}
          </div>
        </div>

        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className={`${styles.preset} ${total === p.seconds && phase === "idle" ? styles.presetActive : ""}`}
              onClick={() => applyPreset(p.seconds)}
              disabled={phase === "running"}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className={styles.controls}>
          {(phase === "idle" || phase === "paused") && (
            <button className={styles.btnPrimary} onClick={start} type="button">
              {phase === "paused" ? "Continuar" : "Iniciar"}
            </button>
          )}
          {phase === "running" && (
            <button
              className={styles.btnSecondary}
              onClick={pause}
              type="button"
            >
              Pausar
            </button>
          )}
          {phase === "done" && (
            <button className={styles.btnPrimary} onClick={reset} type="button">
              De nuevo
            </button>
          )}
          {(phase === "running" || phase === "paused") && (
            <button className={styles.btnGhost} onClick={reset} type="button">
              Reiniciar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
