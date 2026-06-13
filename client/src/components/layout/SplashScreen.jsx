import { useContext, useEffect, useState } from "react";
import { CommunityContext } from "../../context/CommunityContext";
import { useBrandName } from "../../hooks/useBrandName";
import Logo from "../shared/Logo";
import styles from "./SplashScreen.module.css";

// El logo T0 oficial dibujado como SVG inline para poder animarlo pieza por
// pieza (la T se traza, el cero cierra el anillo). El estado base ES el logo ya
// armado: en reduced-motion (o en cualquier render congelado) se ve completo,
// nunca en blanco. Las animaciones viven detrás de
// `@media (prefers-reduced-motion: no-preference)` en el CSS module.
function MarkT0() {
  return (
    <svg
      className={styles.mark}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="TurnoCero"
    >
      <rect
        className={styles.chip}
        x="6"
        y="6"
        width="1012"
        height="1012"
        rx="229"
        ry="229"
        fill="#0b1018"
        stroke="#00aeff"
        strokeWidth="9"
      />
      <rect
        className={styles.arm}
        x="93"
        y="282"
        width="370"
        height="74"
        rx="6"
        ry="6"
        fill="#ffffff"
      />
      <rect
        className={styles.stem}
        x="237"
        y="282"
        width="83"
        height="460"
        rx="6"
        ry="6"
        fill="#ffffff"
      />
      <circle
        className={styles.ring}
        cx="721"
        cy="512"
        r="176.5"
        fill="none"
        stroke="#00aeff"
        strokeWidth="67"
        strokeLinecap="round"
      />
      <circle className={styles.dot} cx="721" cy="512" r="42" fill="#ffffff" />
    </svg>
  );
}

// Si la comunidad-skin/tenant activa define un logo propio, mostramos ESE logo
// (no tiene sentido animar la T0 de TurnoCero para otra marca). "TurnoCero"
// también se parte en Turno + Cero (acento cyan) en el wordmark.
function Wordmark({ brandName }) {
  if (brandName === "TurnoCero") {
    return (
      <span className={styles.wordmarkName}>
        Turno<em>Cero</em>
      </span>
    );
  }
  return <span className={styles.wordmarkName}>{brandName}</span>;
}

export default function SplashScreen({ visible }) {
  const [shouldRender, setShouldRender] = useState(true);
  const [hiding, setHiding] = useState(false);
  const brandName = useBrandName();
  // Logo + tagline de la comunidad-skin/tenant activa (null-safe, igual que
  // useBrandName): si no hay CommunityProvider o no es tenant, cae a la marca
  // TurnoCero (logo T0 animado + "board game meetups").
  const community = useContext(CommunityContext);
  const brand = community?.brand;
  const isTenant = community?.isTenant;
  const hasCustomLogo = Boolean(brand?.logoLight || brand?.logoDark);

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
      {/* motivo de marca: rombos tenues + dot-grid detrás del logo */}
      <div className={styles.bgFx}>
        <span className={`${styles.diamond} ${styles.d2}`} />
        <span className={`${styles.diamond} ${styles.d1}`} />
        <span className={styles.grid} />
      </div>

      <div className={styles.content}>
        <div className={styles.markGlow}>
          {hasCustomLogo ? (
            <Logo
              className={styles.customLogo}
              alt={brandName}
              srcLight={brand?.logoLight}
              srcDark={brand?.logoDark}
            />
          ) : (
            <MarkT0 />
          )}
        </div>

        <div className={styles.wordmark}>
          <Wordmark brandName={brandName} />
          <span className={styles.wordmarkSub}>
            <span className={styles.subDot}>◆</span>
            {isTenant ? "por TurnoCero" : "board game meetups"}
          </span>
        </div>
      </div>

      <div className={styles.loader}>
        <div className={styles.loaderTrack}>
          <div className={styles.loaderFill} />
        </div>
        <span className={styles.loaderText}>
          Preparando tu mesa
          <span className={styles.pips}>
            <span className={styles.pip} />
            <span className={styles.pip} />
            <span className={styles.pip} />
          </span>
        </span>
      </div>
    </div>
  );
}
