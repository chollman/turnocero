import Meeple from "../shared/Meeple";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useSectionEnabled } from "../../hooks/useSectionEnabled";
import { useCommunity } from "../../context/CommunityContext";
import { getUserDisplay } from "../../utils/userDisplay";
import { getActiveNavId } from "../../utils/routing";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import Logo from "../shared/Logo";
import CommunitySwitcher from "./CommunitySwitcher";
import styles from "./Sidebar.module.css";

// Estado inicial del colapso (solo escritorio): persistido en localStorage para
// que la preferencia sobreviva recargas, igual que el tema.
const getInitialCollapsed = () => {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === "true";
  } catch {
    return false;
  }
};

const ICONS = {
  feed: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  dash: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  noticias: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="2" y1="13" x2="12" y2="13" />
      <line x1="2" y1="17" x2="12" y2="17" />
      <line x1="2" y1="9" x2="5" y2="9" />
    </svg>
  ),
  eventos: (
    <svg
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
  ),
  torneos: (
    <svg
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
  ),
  mathtrade: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  calendario: (
    <svg
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
      <line x1="7.5" y1="14" x2="7.5" y2="14" />
      <line x1="12" y1="14" x2="12" y2="14" />
      <line x1="16.5" y1="14" x2="16.5" y2="14" />
      <line x1="7.5" y1="18" x2="7.5" y2="18" />
      <line x1="12" y1="18" x2="12" y2="18" />
    </svg>
  ),
  compartidas: (
    <svg
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
  ),
  comunidades: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  db: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  adminChat: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  bgwatch: (
    <svg
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
  ),
  bgwatchCta: (
    <svg
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
  ),
  panel: (
    <svg
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
  ),
};

// Factory para construir las secciones del nav con labels traducidos. Se llama
// en render (con `t` en scope) en vez de vivir a módulo-scope, así las labels
// pasan por i18n. `label` de cada item queda como string ya traducido, por lo
// que `title={item.label}` sigue funcionando.
const buildSections = (t) => [
  {
    label: t("layout:nav.sections.comunidad"),
    items: [
      {
        id: "compartidas",
        label: t("layout:nav.items.compartite"),
        to: "/compartidas",
        section: "compartidas",
      },
      {
        id: "noticias",
        label: t("layout:nav.items.noticias"),
        to: "/noticias",
        section: "noticias",
      },
      {
        id: "comunidades",
        label: t("layout:nav.items.comunidades"),
        to: "/comunidades",
        section: "comunidades",
      },
    ],
  },
  {
    label: t("layout:nav.sections.encuentros"),
    items: [
      {
        id: "dash",
        label: t("layout:nav.items.mesas"),
        to: "/mesas",
        section: "mesas",
      },
      {
        id: "eventos",
        label: t("layout:nav.items.eventos"),
        to: "/eventos",
        section: "eventos",
      },
      {
        id: "torneos",
        label: t("layout:nav.items.torneos"),
        to: "/torneos",
        section: "torneos",
      },
      {
        id: "mathtrade",
        label: t("layout:nav.items.mathtrade"),
        to: "/math-trade",
        section: "mathtrade",
      },
      {
        id: "calendario",
        label: t("layout:nav.items.calendario"),
        to: "/calendario",
        section: "calendario",
      },
    ],
  },
  {
    label: t("layout:nav.sections.tuyo"),
    items: [
      {
        id: "feed",
        label: t("layout:nav.items.miFeed"),
        to: "/mi",
        section: "miFeed",
      },
      // bgwatch / bgwatchCta resolved at render time depending on user.bggUsername
      { id: "bgwatchSlot", section: "bgwatch" },
    ],
  },
  {
    label: t("layout:nav.sections.admin"),
    adminOnly: true,
    items: [
      {
        id: "panel",
        label: t("layout:nav.items.panelAdmin"),
        to: "/panel-admin",
      },
      {
        id: "db",
        label: t("layout:nav.items.baseDatos"),
        to: "/base-de-datos",
      },
      {
        id: "adminChat",
        label: t("layout:nav.items.chatAdmin"),
        to: "/mensajes-admin",
      },
    ],
  },
];

export default function Sidebar({ open = false, onClose }) {
  const { t } = useTranslation();
  const { user, isActuallyAdmin, logout } = useAuth();
  const { unreadCount, adminChatUnread } = useNotifications();
  // Gating combinado: global (SiteConfig) Y override por comunidad-skin. En modo
  // tenant esto hace que el sidebar respete las secciones de la comunidad del
  // subdominio, en sync con el guard de rutas <SectionGate>.
  const isSectionEnabled = useSectionEnabled();
  const { brand, isTenant } = useCommunity();
  const location = useLocation();
  const navigate = useNavigate();
  const active = getActiveNavId(location.pathname);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  // Colapso a "solo iconos" (escritorio). En mobile el sidebar es un drawer,
  // así que el CSS del colapso vive bajo `@media (min-width: 960px)` y este
  // estado no tiene efecto visible ahí.
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.SIDEBAR_COLLAPSED,
        collapsed ? "true" : "false",
      );
    } catch {
      /* ignore quota errors */
    }
  }, [collapsed]);

  // Reflejar el colapso en <html> para que CADA sección pueda reclamar el
  // espacio que el sidebar deja libre al contraerse (ver `--sidebar-freed` en
  // index.css). El Sidebar sólo se monta para usuarios autenticados fuera de las
  // auth pages, así que el atributo es la fuente de verdad: se limpia al
  // desmontar (logout / pantalla de login / vista de invitado con GuestSidebar).
  useEffect(() => {
    const root = document.documentElement;
    if (collapsed) root.setAttribute("data-sidebar-collapsed", "true");
    else root.removeAttribute("data-sidebar-collapsed");
    return () => root.removeAttribute("data-sidebar-collapsed");
  }, [collapsed]);

  const toggleCollapsed = () => {
    setCollapsed((c) => !c);
    setConfirmingLogout(false);
  };

  const display = getUserDisplay(user);

  // Close the mobile drawer when route changes (skip initial mount).
  const initialPathRef = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname === initialPathRef.current) return;
    if (open && onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close on Escape; lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const resolveItem = (item) => {
    if (item.id === "bgwatchSlot") {
      if (!isSectionEnabled("bgwatch")) return null;
      if (user?.bggUsername) {
        return {
          id: "bgwatch",
          label: t("layout:nav.items.bgwatch"),
          to: `/bg-watch/${user.bggUsername}`,
        };
      }
      return {
        id: "bgwatchCta",
        label: t("layout:nav.items.bgwatchCta"),
        to: "/bg-watch",
        variant: "promo",
        badge: { value: t("layout:nav.items.nuevo"), variant: "promo" },
      };
    }
    // En un subdominio de comunidad (modo tenant) ocultamos el directorio: el
    // sitio se comporta como si fuera la única comunidad.
    if (item.id === "comunidades" && isTenant) return null;
    if (item.section && !isSectionEnabled(item.section)) return null;
    return item;
  };

  const itemBadge = (item) => {
    if (item.badge) return item.badge;
    if (item.id === "adminChat" && adminChatUnread > 0) {
      return {
        value: adminChatUnread > 9 ? "9+" : adminChatUnread,
        variant: "urgent",
      };
    }
    return null;
  };

  // Build visible sections + assign global stagger index (--i) across all items.
  const visibleSections = buildSections(t).map((sec) => {
    if (sec.adminOnly && !isActuallyAdmin) return null;
    const items = sec.items.map(resolveItem).filter(Boolean);
    if (items.length === 0) return null;
    return { ...sec, items };
  }).filter(Boolean);

  let staggerIndex = 0;

  const handleLogoutConfirm = () => {
    logout();
    navigate("/login");
  };

  const renderNavItem = (item) => {
    const isActive = item.id === active;
    const badge = itemBadge(item);
    const cls = [
      styles.navItem,
      isActive ? styles.navItemActive : "",
      item.variant === "promo" ? styles.navItemPromo : "",
    ]
      .filter(Boolean)
      .join(" ");
    const i = staggerIndex++;
    return (
      <Link
        key={item.id}
        to={item.to}
        className={cls}
        style={{ "--i": i }}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        onClick={onClose}
      >
        <span className={styles.navIcon}>{ICONS[item.id]}</span>
        <span className={styles.navLab}>{item.label}</span>
        {badge && (
          <span
            key={badge.value}
            className={`${styles.navBadge} ${
              badge.variant === "live"
                ? styles.navBadgeLive
                : badge.variant === "urgent"
                  ? styles.navBadgeUrgent
                  : badge.variant === "promo"
                    ? styles.navBadgePromo
                    : ""
            }`}
          >
            {badge.value}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {onClose && (
        <div
          className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""} ${
          collapsed ? styles.sidebarCollapsed : ""
        }`}
        aria-hidden={onClose && !open ? "true" : undefined}
      >
        <div className={styles.logoRow}>
          <div className={styles.logo}>
            <Link to="/" className={styles.logoMark} aria-label={brand.name}>
              <Logo
                className={styles.logoMarkImg}
                alt=""
                srcLight={brand.logoLight}
                srcDark={brand.logoDark}
              />
            </Link>
            <span className={styles.logoText}>
              <Link to="/" className={styles.logoName}>
                {brand.name}
              </Link>
              <span className={styles.logoSub}>
                <Meeple />
                {isTenant ? (
                  <>
                    {t("layout:attribution")}{" "}
                    <Link to="/colabora" className={styles.attribution}>
                      TurnoCero
                    </Link>
                  </>
                ) : (
                  "board game meetups"
                )}
              </span>
            </span>
          </div>
          <button
            className={`${styles.bellBtn} ${active === "notif" ? styles.bellBtnActive : ""}`}
            onClick={() => navigate("/notificaciones")}
            aria-label={t("layout:nav.notifications")}
            title={t("layout:nav.notifications")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span key={unreadCount} className={styles.bellBadge}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className={styles.switcherSlot}>
          <CommunitySwitcher onNavigate={onClose} />
        </div>

        <nav className={styles.nav}>
          {visibleSections.map((sec) => (
            <div
              key={sec.label}
              className={`${styles.navSection} ${sec.adminOnly ? styles.navSectionAdmin : ""}`}
            >
              <span className={styles.navSectionLabel}>
                <Meeple />
                {sec.label}
              </span>
              {sec.items.map(renderNavItem)}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.collapseToggle}
            onClick={toggleCollapsed}
            aria-label={
              collapsed
                ? t("layout:sidebar.expand")
                : t("layout:sidebar.collapse")
            }
            title={
              collapsed
                ? t("layout:sidebar.expandTip")
                : t("layout:sidebar.collapseTip")
            }
          >
            <svg
              className={styles.collapseIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
            <span className={styles.collapseLab}>
              {t("layout:sidebar.collapseTip")}
            </span>
          </button>
          {confirmingLogout ? (
            <div className={styles.logoutConfirm}>
              <span className={styles.logoutConfirmLabel}>
                {t("layout:sidebar.logoutConfirm")}
              </span>
              <div className={styles.logoutConfirmActions}>
                <button
                  className={styles.logoutConfirmYes}
                  onClick={handleLogoutConfirm}
                >
                  {t("layout:sidebar.logoutYes")}
                </button>
                <button
                  className={styles.logoutConfirmNo}
                  onClick={() => setConfirmingLogout(false)}
                >
                  {t("layout:sidebar.logoutNo")}
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/perfil"
              className={styles.userTicket}
              onClick={onClose}
              title={collapsed ? display.name || user?.username : undefined}
            >
              <span className={styles.userAvatar} aria-hidden="true">
                {(display.name || "?").charAt(0).toUpperCase()}
              </span>
              <span className={styles.userInfo}>
                <span className={styles.userName}>
                  {display.name || user?.username}
                </span>
                <span className={styles.userMeta}>
                  <span className={styles.statusDot} aria-hidden="true" />@
                  {user?.username}
                </span>
              </span>
              <button
                type="button"
                className={styles.logoutBtn}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmingLogout(true);
                }}
                title={t("layout:sidebar.logout")}
                aria-label={t("layout:sidebar.logout")}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
