import UtilCard from './UtilCard';
import styles from './Utilidades.module.css';

const COMING_SOON_COUNT = 6;

export default function Utilidades() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Utilidades</h1>
        <p className={styles.subtitle}>Mini-apps para la mesa</p>
        <div className={styles.grid}>
          <UtilCard
            icon="👆"
            title="Selector de dedos"
            description="Elegí al azar quién empieza"
            to="/utilidades/selector-de-dedos"
          />
          <UtilCard
            icon="⏱️"
            title="Temporizador"
            description="Cronómetro para el turno"
            to="/utilidades/temporizador"
          />
          <UtilCard
            icon="🎲"
            title="Dado"
            description="Tirá dados configurables"
            to="/utilidades/dado"
          />
          {Array(COMING_SOON_COUNT).fill(null).map((_, i) => (
            <UtilCard key={i} comingSoon />
          ))}
        </div>
      </div>
    </div>
  );
}
