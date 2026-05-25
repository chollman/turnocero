import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { getActiveNavId } from "../../utils/routing";
import styles from "./BottomNav.module.css";

const FeedIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12h18M3 6h18M3 18h12" />
  </svg>
);

const MesasIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const ComunidadIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="7" r="3" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    <path d="M17 14c2.2.5 4 2.3 4 5" />
  </svg>
);

const PerfilIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const CompartidasIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const NoticiasIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M2 15h8M2 19h8M2 11h4" />
  </svg>
);

const DBIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v4c0 1.7 4 3 9 3s9-1.3 9-3V5" />
    <path d="M3 9v4c0 1.7 4 3 9 3s9-1.3 9-3V9" />
    <path d="M3 13v4c0 1.7 4 3 9 3s9-1.3 9-3v-4" />
  </svg>
);

const PanelIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const EventosIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const TorneosIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M6 2v7a6 6 0 0 0 12 0V2z" />
    <line x1="6" y1="22" x2="18" y2="22" />
    <line x1="12" y1="15" x2="12" y2="22" />
    <line x1="9" y1="22" x2="15" y2="22" />
  </svg>
);

const UtilidadesIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const BgWatchIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

const BgWatchCtaIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" strokeDasharray="3 2" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const ChevronLeft = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const REGULAR_NAV = [
  {
    id: "compartidas",
    label: "Compartite",
    Icon: CompartidasIcon,
    to: "/compartidas",
    section: "compartidas",
  },
  {
    id: "noticias",
    label: "Noticias",
    Icon: NoticiasIcon,
    to: "/noticias",
    section: "noticias",
  },
  {
    id: "eventos",
    label: "Eventos",
    Icon: EventosIcon,
    to: "/eventos",
    section: "eventos",
  },
  {
    id: "users",
    label: "Comunidad",
    Icon: ComunidadIcon,
    to: "/usuarios",
    section: "comunidad",
  },
  { id: "profile", label: "Perfil", Icon: PerfilIcon, to: "/perfil" },
  {
    id: "utilidades",
    label: "Utilidades",
    Icon: UtilidadesIcon,
    to: "/utilidades",
    section: "utilidades",
  },
];

const ADMIN_NAV = [
  {
    id: "torneos",
    label: "Torneos",
    Icon: TorneosIcon,
    to: "/torneos",
    section: "torneos",
  },
  {
    id: "dash",
    label: "Mesas",
    Icon: MesasIcon,
    to: "/mesas",
    section: "mesas",
  },
  {
    id: "feed",
    label: "Mi feed",
    Icon: FeedIcon,
    to: "/mi",
    section: "miFeed",
  },
  {
    id: "panel",
    label: "Panel",
    Icon: PanelIcon,
    to: "/panel-admin",
    adminOnly: true,
  },
  {
    id: "db",
    label: "DB",
    Icon: DBIcon,
    to: "/base-de-datos",
    adminOnly: true,
  },
];

const VISIBLE = 3;

export default function BottomNav() {
  const { user, isActuallyAdmin } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const location = useLocation();
  const active = getActiveNavId(location.pathname);

  const isItemVisible = (item) => {
    if (item.adminOnly) return isActuallyAdmin;
    if (item.section) return isSectionEnabled(item.section);
    return true;
  };

  const items = (() => {
    const regular = REGULAR_NAV.filter(isItemVisible);
    if (user && isSectionEnabled("bgwatch")) {
      const idx = regular.findIndex((i) => i.id === "users");
      const insertAt = idx >= 0 ? idx + 1 : 0;
      if (user.bggUsername) {
        regular.splice(insertAt, 0, {
          id: "bgwatch",
          label: "BG Watch",
          Icon: BgWatchIcon,
          to: `/bg-watch/${user.bggUsername}`,
        });
      } else {
        regular.splice(insertAt, 0, {
          id: "bgwatchCta",
          label: "Activá BGW",
          Icon: BgWatchCtaIcon,
          to: "/bg-watch",
          variant: "promo",
        });
      }
    }
    const admin = ADMIN_NAV.filter(isItemVisible);
    return isActuallyAdmin && admin.length > 0
      ? [...regular, ...admin]
      : regular;
  })();

  const total = items.length;
  const scrollable = total > VISIBLE;

  const [startIndex, setStartIndex] = useState(0);
  const [slideDir, setSlideDir] = useState(null);
  const touchStartX = useRef(null);

  const visibleItems = scrollable
    ? items.slice(startIndex, startIndex + VISIBLE)
    : items;
  const canGoLeft = scrollable && startIndex > 0;
  const canGoRight = scrollable && startIndex + VISIBLE < total;

  // Pager: number of pages and which one we're on.
  const pageCount = Math.max(1, Math.ceil(total / VISIBLE));
  const activePage = Math.min(pageCount - 1, Math.floor(startIndex / VISIBLE));

  function goLeft() {
    if (!canGoLeft) return;
    setSlideDir("right");
    setStartIndex((i) => i - 1);
  }

  function goRight() {
    if (!canGoRight) return;
    setSlideDir("left");
    setStartIndex((i) => i + 1);
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (delta > 50) goRight();
    else if (delta < -50) goLeft();
  }

  // Keep the active item visible when navigating via router.
  // Intencionalmente solo `[active]`: `startIndex` se LEE y MUTA dentro del
  // effect — incluirlo loopearía (cada setStartIndex re-corre el effect que
  // re-llama setStartIndex). `items` es estable per-render del padre y
  // `scrollable` es derivado del mismo items. Acepto la stale-startIndex
  // closure: si el user cambia tabs muy rápido, la siguiente nav corrige.
  useEffect(() => {
    if (!scrollable) return;
    const activeIdx = items.findIndex((item) => item.id === active);
    if (activeIdx < 0) return;
    if (activeIdx < startIndex) {
      setSlideDir("right");
      setStartIndex(activeIdx);
    } else if (activeIdx >= startIndex + VISIBLE) {
      setSlideDir("left");
      setStartIndex(activeIdx - VISIBLE + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const animClass =
    slideDir === "left"
      ? styles.slideLeft
      : slideDir === "right"
        ? styles.slideRight
        : "";

  const renderItem = (item) => {
    const { id, label, Icon, to, variant } = item;
    const isActive = id === active;
    const isPromo = variant === "promo";
    const cls = [
      styles.item,
      isActive && !isPromo ? styles.itemActive : "",
      isPromo ? styles.itemPromo : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <Link
        key={id}
        to={to}
        className={cls}
        aria-current={isActive ? "page" : undefined}
      >
        <span className={styles.icon}>
          <Icon />
        </span>
        <span className={styles.label}>{label}</span>
        {isPromo && <span className={styles.promoTag}>NEW</span>}
      </Link>
    );
  };

  return (
    <nav
      className={styles.nav}
      onTouchStart={scrollable ? handleTouchStart : undefined}
      onTouchEnd={scrollable ? handleTouchEnd : undefined}
    >
      {scrollable && (
        <button
          className={styles.arrow}
          onClick={goLeft}
          style={{ visibility: canGoLeft ? "visible" : "hidden" }}
          aria-label="Anterior"
        >
          <ChevronLeft />
        </button>
      )}

      <div key={startIndex} className={`${styles.items} ${animClass}`}>
        {visibleItems.map(renderItem)}
        {/* Pad with invisible slots if last page has fewer than VISIBLE items */}
        {visibleItems.length < VISIBLE &&
          Array.from({ length: VISIBLE - visibleItems.length }).map((_, i) => (
            <span
              key={`pad-${i}`}
              className={styles.itemFiller}
              aria-hidden="true"
            />
          ))}
      </div>

      {scrollable && (
        <button
          className={styles.arrow}
          onClick={goRight}
          style={{ visibility: canGoRight ? "visible" : "hidden" }}
          aria-label="Siguiente"
        >
          <ChevronRight />
        </button>
      )}

      {scrollable && (
        <div className={styles.pager} aria-hidden="true">
          {Array.from({ length: pageCount }).map((_, i) => (
            <span
              key={i}
              className={`${styles.pagerDot} ${i === activePage ? styles.pagerDotActive : ""}`}
            />
          ))}
        </div>
      )}
    </nav>
  );
}
