import Meeple from "../shared/Meeple";
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSectionEnabled } from "../../hooks/useSectionEnabled";
import { useCommunity } from "../../context/CommunityContext";
import { getActiveNavId } from "../../utils/routing";
import Logo from "../shared/Logo";
import styles from "./GuestSidebar.module.css";

const ICONS = {
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
  utilidades: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
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
};

const NAV = [
  {
    id: "compartidas",
    label: "Compartidas",
    to: "/compartidas",
    section: "compartidas",
  },
  { id: "noticias", label: "Noticias", to: "/noticias", section: "noticias" },
  {
    id: "calendario",
    label: "Calendario",
    to: "/calendario",
    section: "calendario",
  },
  {
    id: "utilidades",
    label: "Utilidades",
    to: "/utilidades",
    section: "utilidades",
  },
];

export default function GuestSidebar({ open = false, onClose }) {
  const { pathname } = useLocation();
  // Gating combinado global + override por comunidad-skin (ver useSectionEnabled).
  const isSectionEnabled = useSectionEnabled();
  // En modo tenant (subdominio / ?tenant) la marca es la de la comunidad.
  const { isTenant, brand } = useCommunity();
  const active = getActiveNavId(pathname);
  const visibleNav = NAV.filter((item) => isSectionEnabled(item.section));

  const initialPathRef = useRef(pathname);
  useEffect(() => {
    if (pathname === initialPathRef.current) return;
    if (open && onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}
        aria-hidden={onClose && !open ? "true" : undefined}
      >
        <div className={styles.logoRow}>
          <Link
            to="/"
            className={styles.logo}
            aria-label={isTenant ? brand.name : "TurnoCero"}
          >
            <span className={styles.logoMark} aria-hidden="true">
              <Logo
                className={styles.logoMarkImg}
                alt=""
                srcLight={isTenant ? brand.logoLight : undefined}
                srcDark={isTenant ? brand.logoDark : undefined}
              />
            </span>
            <span className={styles.logoText}>
              <span className={styles.logoName}>
                {isTenant ? brand.name : "TurnoCero"}
              </span>
              <span className={styles.logoSub}>
                <Meeple />
                {isTenant && brand.tagline
                  ? brand.tagline
                  : "board game meetups"}
              </span>
            </span>
          </Link>
        </div>

        <nav className={styles.nav}>
          {visibleNav.length > 0 && (
            <div className={styles.navSection}>
              <span className={styles.navSectionLabel}>
                <Meeple />
                Comunidad
              </span>
              {visibleNav.map((item, i) => {
                const isActive = active === item.id;
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    style={{ "--i": i }}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={onClose}
                  >
                    <span className={styles.navIcon}>{ICONS[item.id]}</span>
                    <span className={styles.navLab}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link to="/login" className={styles.btnLogin} onClick={onClose}>
            Login
          </Link>
          <Link to="/register" className={styles.btnRegister} onClick={onClose}>
            Registrate
          </Link>
        </div>
      </aside>
    </>
  );
}
