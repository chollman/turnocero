import styles from "../pages/Auth.module.css";

export default function AuthLogo() {
  return (
    <div className={styles.logoArea}>
      <span className={styles.dice}>🎲</span>
      <h1 className={styles.appName}>Turnocero</h1>
      <p className={styles.tagline}>Tu mesa te espera</p>
    </div>
  );
}
