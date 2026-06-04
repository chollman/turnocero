import { useEffect, useState } from "react";
import { useBrandName } from "../../hooks/useBrandName";
import styles from "./SplashScreen.module.css";

const PIECES = [
  {
    symbol: "⚅",
    left: "4%",
    size: "9rem",
    duration: "5s",
    delay: "0s",
    opacity: 0.45,
  },
  {
    symbol: "♟",
    left: "12%",
    size: "7rem",
    duration: "6.5s",
    delay: "-1.2s",
    opacity: 0.38,
  },
  {
    symbol: "♞",
    left: "22%",
    size: "11rem",
    duration: "4.8s",
    delay: "-2.4s",
    opacity: 0.35,
  },
  {
    symbol: "♠",
    left: "32%",
    size: "6.5rem",
    duration: "7s",
    delay: "-0.6s",
    opacity: 0.42,
  },
  {
    symbol: "⚂",
    left: "42%",
    size: "8.5rem",
    duration: "5.5s",
    delay: "-3.1s",
    opacity: 0.4,
  },
  {
    symbol: "♛",
    left: "52%",
    size: "12rem",
    duration: "6s",
    delay: "-1.8s",
    opacity: 0.33,
  },
  {
    symbol: "♦",
    left: "62%",
    size: "6rem",
    duration: "4.5s",
    delay: "-0.9s",
    opacity: 0.44,
  },
  {
    symbol: "♜",
    left: "71%",
    size: "10rem",
    duration: "7.5s",
    delay: "-2.7s",
    opacity: 0.37,
  },
  {
    symbol: "⚀",
    left: "80%",
    size: "8rem",
    duration: "5.2s",
    delay: "-3.8s",
    opacity: 0.42,
  },
  {
    symbol: "♣",
    left: "89%",
    size: "7.5rem",
    duration: "6.8s",
    delay: "-1.5s",
    opacity: 0.38,
  },
  {
    symbol: "⚄",
    left: "8%",
    size: "10.5rem",
    duration: "8s",
    delay: "-4.5s",
    opacity: 0.3,
  },
  {
    symbol: "♥",
    left: "47%",
    size: "7rem",
    duration: "4.2s",
    delay: "-2s",
    opacity: 0.4,
  },
  {
    symbol: "♞",
    left: "66%",
    size: "6.5rem",
    duration: "5.8s",
    delay: "-0.4s",
    opacity: 0.35,
  },
  {
    symbol: "⚃",
    left: "28%",
    size: "11.5rem",
    duration: "6.3s",
    delay: "-3.3s",
    opacity: 0.32,
  },
  {
    symbol: "♛",
    left: "93%",
    size: "9.5rem",
    duration: "5.6s",
    delay: "-1.9s",
    opacity: 0.36,
  },
];

export default function SplashScreen({ visible }) {
  const [shouldRender, setShouldRender] = useState(true);
  const [hiding, setHiding] = useState(false);
  const brandName = useBrandName();

  useEffect(() => {
    if (!visible) {
      setHiding(true);
      const t = setTimeout(() => setShouldRender(false), 700);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!shouldRender) return null;

  return (
    <div
      className={`${styles.splash} ${hiding ? styles.hiding : ""}`}
      aria-hidden="true"
    >
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={styles.piece}
          style={{
            left: p.left,
            fontSize: p.size,
            animationDuration: p.duration,
            animationDelay: p.delay,
            opacity: p.opacity,
          }}
        >
          {p.symbol}
        </span>
      ))}
      <div className={styles.content}>
        <div className={styles.logo}>🎲</div>
        <h1 className={styles.title}>{brandName}</h1>
        <p className={styles.subtitle}>Organizá tu mesa</p>
        <div className={styles.dots}>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
