import styles from "./BoardGameBackground.module.css";

const PIECES = [
  {
    symbol: "⚅",
    left: "4%",
    size: "8.8rem",
    duration: "42s",
    delay: "0s",
    opacity: 0.07,
  },
  {
    symbol: "♟",
    left: "11%",
    size: "11.2rem",
    duration: "57s",
    delay: "-11s",
    opacity: 0.05,
  },
  {
    symbol: "♞",
    left: "20%",
    size: "12.8rem",
    duration: "51s",
    delay: "-26s",
    opacity: 0.06,
  },
  {
    symbol: "♠",
    left: "29%",
    size: "7.6rem",
    duration: "66s",
    delay: "-6s",
    opacity: 0.05,
  },
  {
    symbol: "⚂",
    left: "38%",
    size: "9.6rem",
    duration: "46s",
    delay: "-16s",
    opacity: 0.07,
  },
  {
    symbol: "♛",
    left: "48%",
    size: "14.4rem",
    duration: "72s",
    delay: "-31s",
    opacity: 0.05,
  },
  {
    symbol: "♦",
    left: "57%",
    size: "6.8rem",
    duration: "43s",
    delay: "-9s",
    opacity: 0.06,
  },
  {
    symbol: "♜",
    left: "65%",
    size: "12rem",
    duration: "59s",
    delay: "-21s",
    opacity: 0.05,
  },
  {
    symbol: "⚀",
    left: "74%",
    size: "8.8rem",
    duration: "49s",
    delay: "-36s",
    opacity: 0.07,
  },
  {
    symbol: "♣",
    left: "81%",
    size: "8.4rem",
    duration: "63s",
    delay: "-13s",
    opacity: 0.05,
  },
  {
    symbol: "♟",
    left: "89%",
    size: "10.4rem",
    duration: "53s",
    delay: "-23s",
    opacity: 0.06,
  },
  {
    symbol: "⚃",
    left: "2%",
    size: "12.4rem",
    duration: "77s",
    delay: "-41s",
    opacity: 0.05,
  },
  {
    symbol: "♥",
    left: "44%",
    size: "9.2rem",
    duration: "44s",
    delay: "-19s",
    opacity: 0.05,
  },
  {
    symbol: "♞",
    left: "69%",
    size: "7.6rem",
    duration: "68s",
    delay: "-29s",
    opacity: 0.06,
  },
  {
    symbol: "⚄",
    left: "54%",
    size: "10.8rem",
    duration: "54s",
    delay: "-47s",
    opacity: 0.06,
  },
  {
    symbol: "♛",
    left: "16%",
    size: "8rem",
    duration: "61s",
    delay: "-34s",
    opacity: 0.04,
  },
  {
    symbol: "♠",
    left: "92%",
    size: "10rem",
    duration: "39s",
    delay: "-7s",
    opacity: 0.05,
  },
  {
    symbol: "⚁",
    left: "33%",
    size: "7.2rem",
    duration: "70s",
    delay: "-52s",
    opacity: 0.06,
  },
];

export default function BoardGameBackground() {
  return (
    <div className={styles.background} aria-hidden="true">
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
    </div>
  );
}
