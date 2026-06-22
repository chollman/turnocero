import Meeple from "../../components/shared/Meeple";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { getLocale } from "../../utils/locale";
import styles from "./ErrorScreen.module.css";

// ─── Iconos inline (no usamos librerías de iconos en el proyecto) ──────────
const Icon = {
  home: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  back: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  retry: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 4v6h-6" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  dice: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="16" cy="8" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="8" cy="16" r="1.3" fill="currentColor" />
      <circle cx="16" cy="16" r="1.3" fill="currentColor" />
    </svg>
  ),
  calendar: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  heart: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  mail: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  ),
};

// ─── Monograma de marca ────────────────────────────────────────────────────
function Brand() {
  return (
    <div className={styles.errBrand}>
      <div className={styles.errBrandMark}>
        <div className={styles.t}>
          <div className={styles.arm} />
          <div className={styles.stem} />
        </div>
        <div className={styles.ring} />
      </div>
      <span className={styles.errBrandName}>TurnoCero</span>
    </div>
  );
}

// ─── Backdrop decorativo de piezas de juego ────────────────────────────────
function meeple(fill, op = 1) {
  return (
    <path
      d="M12 2c1.5 0 2.7 1.2 2.7 2.7 0 1-.5 1.8-1.3 2.3 2 .6 3.4 1.7 4 3.3l1.3 4c.2.7-.2 1.4-.9 1.6-.7.2-1.4-.2-1.6-.9l-.6-1.9V21a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-3h-.4v3a1 1 0 0 1-1 1H9.4a1 1 0 0 1-1-1v-7.8l-.6 1.9c-.2.7-.9 1.1-1.6.9-.7-.2-1.1-.9-.9-1.6l1.3-4c.6-1.6 2-2.7 4-3.3-.8-.5-1.3-1.3-1.3-2.3C9.3 3.2 10.5 2 12 2z"
      fill={fill}
      opacity={op}
    />
  );
}

function Backdrop({ is500 }) {
  const edge = is500 ? "var(--orange)" : "var(--amber)";
  const die = is500 ? "var(--red)" : "var(--amber-light)";
  const tint = is500 ? "rgba(245,166,35,0.08)" : "rgba(24,136,239,0.08)";
  return (
    <div className={styles.errBackdrop} aria-hidden="true">
      {/* hex tile arriba-izquierda */}
      <svg
        className={styles.errPiece}
        style={{ top: "12%", left: "10%", "--r": "-8deg" }}
        width="90"
        height="90"
        viewBox="0 0 100 100"
      >
        <polygon
          points="50,5 90,28 90,72 50,95 10,72 10,28"
          fill="none"
          stroke={edge}
          strokeWidth="2"
          opacity="0.5"
        />
        <polygon points="50,22 73,35 73,65 50,78 27,65 27,35" fill={tint} />
      </svg>
      {/* dado arriba-derecha */}
      <svg
        className={styles.errPiece}
        style={{ top: "16%", right: "12%", "--r": "12deg" }}
        width="64"
        height="64"
        viewBox="0 0 40 40"
      >
        <rect
          x="3"
          y="3"
          width="34"
          height="34"
          rx="7"
          fill="var(--bg-card)"
          stroke={die}
          strokeWidth="1.5"
        />
        <circle cx="13" cy="13" r="2.4" fill={die} />
        <circle cx="27" cy="13" r="2.4" fill={die} />
        <circle cx="20" cy="20" r="2.4" fill={die} />
        <circle cx="13" cy="27" r="2.4" fill={die} />
        <circle cx="27" cy="27" r="2.4" fill={die} />
      </svg>
      {/* meeple medio-izquierda */}
      <svg
        className={styles.errPiece}
        style={{ top: "58%", left: "7%", "--r": "6deg" }}
        width="46"
        height="46"
        viewBox="0 0 24 24"
      >
        {meeple("var(--green)", 0.5)}
      </svg>
      {/* meeple abajo-derecha */}
      <svg
        className={styles.errPiece}
        style={{ bottom: "14%", right: "9%", "--r": "-14deg" }}
        width="54"
        height="54"
        viewBox="0 0 24 24"
      >
        {meeple("var(--purple)", 0.45)}
      </svg>
      {/* carta chica abajo-izquierda */}
      <svg
        className={styles.errPiece}
        style={{ bottom: "12%", left: "14%", "--r": "10deg" }}
        width="50"
        height="68"
        viewBox="0 0 50 68"
      >
        <rect
          x="2"
          y="2"
          width="46"
          height="64"
          rx="6"
          fill="var(--bg-card)"
          stroke={edge}
          strokeWidth="1.5"
          opacity="0.6"
        />
        <circle cx="12" cy="12" r="3" fill={edge} opacity="0.6" />
        <circle cx="38" cy="56" r="3" fill={edge} opacity="0.6" />
      </svg>
      {/* meeple arriba-centro */}
      <svg
        className={styles.errPiece}
        style={{ top: "8%", left: "46%", "--r": "-5deg" }}
        width="38"
        height="38"
        viewBox="0 0 24 24"
      >
        {meeple("var(--orange)", 0.4)}
      </svg>
    </div>
  );
}

// ─── Hero 404: dado mostrando "?" caído fuera del tablero ──────────────────
function Hero404() {
  return (
    <div className={styles.errHero}>
      <svg viewBox="0 0 200 160" aria-hidden="true">
        <defs>
          <linearGradient id="errDie404" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--bg-elevated)" />
            <stop offset="100%" stopColor="var(--bg-dark)" />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="142" rx="56" ry="9" fill="#000" opacity="0.3" />
        <path
          d="M10 120 Q70 108 150 116"
          stroke="var(--border)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="5 6"
        />
        <g transform="translate(100 72) rotate(-12)">
          <rect
            x="-46"
            y="-46"
            width="92"
            height="92"
            rx="18"
            fill="url(#errDie404)"
            stroke="var(--border-strong)"
            strokeWidth="2"
          />
          <text
            x="0"
            y="2"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Poppins, sans-serif"
            fontSize="58"
            fontWeight="800"
            fill="var(--amber-light)"
          >
            ?
          </text>
        </g>
        <g
          stroke="var(--amber)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.6"
        >
          <line x1="158" y1="40" x2="166" y2="32" />
          <line x1="168" y1="54" x2="178" y2="50" />
          <line x1="150" y1="26" x2="154" y2="16" />
        </g>
      </svg>
    </div>
  );
}

// ─── Hero 500: pila de piezas volcadas + dado con "X" ──────────────────────
function Hero500() {
  return (
    <div className={styles.errHero}>
      <svg viewBox="0 0 200 160" aria-hidden="true">
        <ellipse cx="100" cy="140" rx="62" ry="10" fill="#000" opacity="0.3" />
        <g transform="translate(70 95) rotate(-18)">
          <rect
            x="-26"
            y="-14"
            width="52"
            height="28"
            rx="5"
            fill="var(--bg-elevated)"
            stroke="var(--red)"
            strokeWidth="2"
          />
        </g>
        <g transform="translate(120 100) rotate(14)">
          <rect
            x="-24"
            y="-13"
            width="48"
            height="26"
            rx="5"
            fill="var(--bg-elevated)"
            stroke="var(--orange)"
            strokeWidth="2"
          />
        </g>
        <g transform="translate(96 70) rotate(-6)">
          <rect
            x="-22"
            y="-12"
            width="44"
            height="24"
            rx="5"
            fill="var(--bg-elevated)"
            stroke="var(--amber-light)"
            strokeWidth="2"
          />
        </g>
        <g transform="translate(140 52) rotate(20)">
          <rect
            x="-22"
            y="-22"
            width="44"
            height="44"
            rx="10"
            fill="var(--bg-card)"
            stroke="var(--red)"
            strokeWidth="2"
          />
          <g stroke="var(--red)" strokeWidth="3.5" strokeLinecap="round">
            <line x1="-9" y1="-9" x2="9" y2="9" />
            <line x1="9" y1="-9" x2="-9" y2="9" />
          </g>
        </g>
        <g
          stroke="var(--orange)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.6"
        >
          <line x1="40" y1="44" x2="32" y2="36" />
          <line x1="30" y1="58" x2="20" y2="54" />
        </g>
      </svg>
    </div>
  );
}

// Iconos de los botones por variante (el copy sale de i18n in-component).
const ACTION_ICONS = {
  404: { primary: Icon.home, secondary: Icon.back },
  500: { primary: Icon.retry, secondary: Icon.home },
};

// Genera un id de incidente pseudo-aleatorio para que soporte tenga algo
// accionable (no hay correlation-id de backend para crashes de render).
function makeIncident() {
  const num = Math.floor(1000 + Math.random() * 9000);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  const suffix =
    chars[Math.floor(Math.random() * chars.length)] +
    chars[Math.floor(Math.random() * chars.length)];
  let stamp;
  try {
    stamp = new Intl.DateTimeFormat(getLocale(), {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    stamp = new Date().toISOString();
  }
  return { code: `TC-${num}-${suffix}`, stamp };
}

/**
 * Pantalla de error full-screen (404 / 500). Presentacional: recibe los
 * handlers de navegación y, para el 404, la lista de quick links ya filtrada.
 * Se portalea a `document.body` para escapar de los transforms de
 * PageTransition (mismo motivo que el Modal compartido).
 */
export default function ErrorScreen({
  variant = "404",
  onPrimary,
  onSecondary,
  links = [],
}) {
  const { t } = useTranslation();
  const is500 = variant === "500";
  const v = is500 ? "500" : "404";
  const icons = ACTION_ICONS[v];
  const copy = {
    eyebrow: t(`error:screen.eyebrow${v}`),
    text: t(`error:screen.text${v}`),
    primary: { label: t(`error:screen.primary${v}`), icon: icons.primary },
    secondary: { label: t(`error:screen.secondary${v}`), icon: icons.secondary },
  };
  const [copied, setCopied] = useState(false);
  const [incident] = useState(() => (is500 ? makeIncident() : null));

  // Título imperativo (no Helmet): la pantalla 500 debe ser auto-contenida y no
  // depender de maquinaria que podría haber fallado. Restaura el título previo
  // al desmontar, así una recuperación in-place no deja el tab en "error".
  useEffect(() => {
    const prev = document.title;
    document.title = t(is500 ? "error:screen.docTitle500" : "error:screen.docTitle404");
    return () => {
      document.title = prev;
    };
  }, [is500, t]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(incident.code);
    } catch {
      /* clipboard puede no estar disponible — el código sigue visible */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return createPortal(
    <div className={`${styles.errStage} ${is500 ? styles.is500 : ""}`}>
      <Backdrop is500={is500} />

      <div className={styles.errCard}>
        <Brand />

        {is500 ? <Hero500 /> : <Hero404 />}

        <h1 className={styles.errCode}>{is500 ? "500" : "404"}</h1>

        <span className={styles.errEyebrow}>{copy.eyebrow}</span>
        <h2 className={styles.errTitle}>
          <Trans i18nKey={`error:screen.title${v}`} components={{ em: <em /> }} />
        </h2>
        <p className={styles.errText}>{copy.text}</p>

        <div className={styles.errActions}>
          <button
            type="button"
            className={`${styles.errBtn} ${styles.errBtnPrimary}`}
            onClick={onPrimary}
          >
            {copy.primary.icon} {copy.primary.label}
          </button>
          <button
            type="button"
            className={`${styles.errBtn} ${styles.errBtnGhost}`}
            onClick={onSecondary}
          >
            {copy.secondary.icon} {copy.secondary.label}
          </button>
        </div>

        {is500 ? (
          <div className={styles.errIncident}>
            <span className={styles.dot} />
            <span>
              <Trans
                i18nKey="error:screen.incident"
                values={{ code: incident.code, stamp: incident.stamp }}
                components={{ strong: <strong /> }}
              />
            </span>
            <button
              type="button"
              className={styles.errCopy}
              onClick={handleCopy}
              aria-live="polite"
            >
              {copied ? t("error:screen.copied") : t("error:screen.copy")}
            </button>
          </div>
        ) : (
          links.length > 0 && (
            <div className={styles.errLinks}>
              <span className={styles.errLinksLabel}>
                <Meeple />
                {t("error:screen.quickLinks")}
              </span>
              {links.map((l) => (
                <Link key={l.to} className={styles.errLink} to={l.to}>
                  {Icon[l.icon]} {l.label}
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </div>,
    document.body,
  );
}
