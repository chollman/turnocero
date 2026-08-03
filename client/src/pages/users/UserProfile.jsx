import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import {
  geocodeAddress,
  connectBgg,
  syncBgg,
  disconnectBgg,
  uploadAvatar,
  removeAvatar,
} from "../../queries/users";
import MiBgWatchCard from "./MiBgWatchCard";
import CommunityPrefs from "./CommunityPrefs";
import Avatar from "../../components/shared/Avatar";
import AvatarCropModal from "../../components/shared/AvatarCropModal";
import AvatarColorPicker from "../../components/shared/AvatarColorPicker";
import { hashToBrandColor, isValidAvatarColor } from "../../utils/hash";
import { getInitials } from "../../utils/initials";
import { getUserDisplay } from "../../utils/userDisplay";
import { getLocale } from "../../utils/locale";
import {
  bggConnectErrorMessage,
  bggSyncErrorMessage,
} from "../../utils/bggErrors";
import PasswordInput from "../../components/shared/PasswordInput";
import AddressMap from "../../components/shared/AddressMap";
import PlaceAutocomplete from "../../components/shared/PlaceAutocomplete";
import usePushNotifications from "../../hooks/usePushNotifications";
import styles from "./UserProfile.module.css";

const AVATAR_MIME = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const BGWATCH_BANNER_DISMISS_KEY = "turnocero_bgwatch_profile_banner_dismissed";

const probeOutcomeLabel = (t) => ({
  no_drift: t("usuarios:profile.probeNoDrift"),
  edits_only: t("usuarios:profile.probeEditsOnly"),
  reconciled: t("usuarios:profile.probeReconciled"),
  failed: t("usuarios:profile.probeFailed"),
});

function relativeTime(date, t) {
  if (!date) return null;
  const diffSec = (Date.now() - new Date(date).getTime()) / 1000;
  if (diffSec < 60) return t("usuarios:profile.relativeJustNow");
  if (diffSec < 3600)
    return t("usuarios:profile.relativeMinutes", {
      count: Math.floor(diffSec / 60),
    });
  if (diffSec < 86400)
    return t("usuarios:profile.relativeHours", {
      count: Math.floor(diffSec / 3600),
    });
  if (diffSec < 604800)
    return t("usuarios:profile.relativeDays", {
      count: Math.floor(diffSec / 86400),
    });
  return new Date(date).toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MoonIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SunIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

// Ícono "refresh-cw" (handoff: Icon.Refresh) para "Reconciliar todo con BGG".
const RefreshIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

// Rail de índice (derecha en desktop, arriba en mobile): navegación por sección
// con scrollspy + el botón Guardar. El Guardar dispara el mismo submit del form.
function Rail({ sections, active, onJump, saving, saved, dirty, onSave }) {
  const { t } = useTranslation();
  return (
    <aside className={styles.railWrap}>
      <nav
        className={styles.railNav}
        aria-label={t("usuarios:profile.railSectionsAria")}
      >
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.railItem} ${active === s.id ? styles.railItemActive : ""}`}
            onClick={() => onJump(s.id)}
            aria-current={active === s.id ? "true" : undefined}
          >
            <span className={styles.railDot} aria-hidden="true" />
            {s.label}
          </button>
        ))}
      </nav>
      <button
        type="button"
        className={styles.railSave}
        onClick={onSave}
        disabled={saving || !dirty}
      >
        {saving
          ? t("usuarios:profile.saving")
          : t("usuarios:profile.saveChanges")}
      </button>
      {saved && (
        <div className={styles.railSaved}>
          {t("usuarios:profile.profileSaved")}
        </div>
      )}
    </aside>
  );
}

export default function UserProfile() {
  const { t } = useTranslation();
  const { user, updateProfile, refreshUser } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const brandName = useBrandName();
  // theme se sigue usando para Apariencia (toggle dark/light); el mapa lo lee
  // por su cuenta vía useTheme dentro de AddressMap.
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useLanguage();
  const { addToast } = useNotifications();

  // Cambia el idioma de la UI (LanguageContext) y, si hay sesión, lo persiste
  // en el server (User.language) para que emails/push respeten la preferencia.
  const changeLanguage = (next) => {
    setLang(next);
    if (user) updateProfile({ language: next }).catch(() => {});
  };
  const bgwatchEnabled = isSectionEnabled("bgwatch");
  const pushEnabled = isSectionEnabled("push");
  const push = usePushNotifications();

  const handlePushSubscribe = async () => {
    const ok = await push.subscribe();
    addToast(
      ok
        ? {
            type: "success",
            title: t("usuarios:profile.pushSuccessTitle"),
            message: t("usuarios:profile.pushSuccessMessage"),
          }
        : {
            type: "error",
            title: t("usuarios:profile.pushErrorTitle"),
            message: t("usuarios:profile.pushErrorMessage"),
          },
    );
  };

  const handlePushUnsubscribe = async () => {
    const ok = await push.unsubscribe();
    addToast(
      ok
        ? {
            type: "success",
            title: t("usuarios:profile.pushOffTitle"),
            message: t("usuarios:profile.pushOffMessage"),
          }
        : {
            type: "error",
            title: t("usuarios:profile.pushOffErrorTitle"),
            message: t("usuarios:profile.pushOffErrorMessage"),
          },
    );
  };

  function renderPushControl() {
    // iOS en pestaña: el push solo anda con la PWA instalada. Va PRIMERO porque
    // ahí `isSupported` es false, pero el mensaje útil es "instalá", no
    // "no soporta".
    if (push.requiresStandalone) {
      return (
        <p className={styles.hint}>
          {t("usuarios:profile.pushInstallHint", { brand: brandName })}
        </p>
      );
    }
    if (!push.isSupported) {
      return (
        <p className={styles.hint}>{t("usuarios:profile.pushUnsupported")}</p>
      );
    }
    if (push.permission === "denied") {
      return <p className={styles.hint}>{t("usuarios:profile.pushDenied")}</p>;
    }
    if (push.isSubscribed) {
      return (
        <button
          type="button"
          className={styles.btnGhost}
          disabled={push.busy}
          onClick={handlePushUnsubscribe}
        >
          {push.busy
            ? t("usuarios:profile.pushDeactivating")
            : t("usuarios:profile.pushDeactivate")}
        </button>
      );
    }
    return (
      <button
        type="button"
        className={styles.btnPrimary}
        disabled={push.busy}
        onClick={handlePushSubscribe}
      >
        {push.busy
          ? t("usuarios:profile.pushActivating")
          : t("usuarios:profile.pushActivate")}
      </button>
    );
  }

  // ── BGG connection state ──
  const [bggPassword, setBggPassword] = useState("");
  const [bggBusy, setBggBusy] = useState(false);
  const [bggError, setBggError] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncSuccess, setSyncSuccess] = useState("");

  // ── BG Watch promo banner (F.1) ──
  const [bgWatchBannerDismissed, setBgWatchBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(BGWATCH_BANNER_DISMISS_KEY) === "1";
  });

  const handleDismissBgWatchBanner = () => {
    try {
      window.localStorage.setItem(BGWATCH_BANNER_DISMISS_KEY, "1");
    } catch {
      // localStorage may be unavailable (private mode, etc.) — just hide for this session
    }
    setBgWatchBannerDismissed(true);
  };

  // Ref + input ref del campo de BGG username. Antes esto se hacía con
  // `document.getElementById('bgg-username-field').querySelector('input')`
  // — frágil ante renames del ID o cambios de estructura. El ID se mantiene
  // solo para el anchor link `href="#bgg-username-field"` del browser.
  const bggFieldRef = useRef(null);
  const bggInputRef = useRef(null);
  const handleFocusBggField = (e) => {
    e.preventDefault();
    bggFieldRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    bggInputRef.current?.focus({ preventScroll: true });
  };

  const [form, setForm] = useState({
    displayName: "",
    nombre: "",
    apellido: "",
    telegram: "",
    celular: "",
    bggUsername: "",
    direccionTexto: "",
    lat: null,
    lng: null,
    eventoReminderHours: 24,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  // ── Avatar state ──
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef(null);

  const errorTimerRef = useRef(null);
  const successTimerRef = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(errorTimerRef.current);
      clearTimeout(successTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!user) return;
    setForm({
      displayName: user.displayName || "",
      nombre: user.nombre || "",
      apellido: user.apellido || "",
      telegram: user.telegram || "",
      celular: user.celular || "",
      bggUsername: user.bggUsername || "",
      direccionTexto: user.direccion?.texto || "",
      lat: user.direccion?.lat ?? null,
      lng: user.direccion?.lng ?? null,
      eventoReminderHours: user.eventoReminderHours ?? 24,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Usuario eligió una sugerencia del autocomplete → set texto + coords.
  const handlePlaceSelect = ({ lat, lng, formattedAddress }) => {
    setForm((prev) => ({
      ...prev,
      direccionTexto: formattedAddress || prev.direccionTexto,
      lat,
      lng,
    }));
  };

  // Click en el mapa o drag del marker → solo coords (el texto queda como esté).
  const handleMapChange = (lat, lng) => {
    setForm((prev) => ({ ...prev, lat, lng }));
  };

  // Fallback: el usuario tipeó algo pero no picó una sugerencia.
  // Llama a /api/geocode (cache server-side) para resolver el texto.
  const handleManualGeocode = async () => {
    const q = form.direccionTexto.trim();
    if (q.length < 3) {
      setError(t("usuarios:profile.geocodeTooShort"));
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(""), 3000);
      return;
    }
    setGeocoding(true);
    try {
      const data = await geocodeAddress(q);
      setForm((prev) => ({
        ...prev,
        direccionTexto: data.formatted || prev.direccionTexto,
        lat: data.lat,
        lng: data.lng,
      }));
    } catch (err) {
      const msg =
        err.response?.status === 404
          ? t("usuarios:profile.geocodeNotFound")
          : err.response?.data?.message || t("usuarios:profile.geocodeError");
      setError(msg);
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(""), 3000);
    } finally {
      setGeocoding(false);
    }
  };

  const handleBggConnect = async () => {
    if (!user?.bggUsername) {
      setBggError(t("usuarios:profile.bggConfigureFirst"));
      return;
    }
    if (!bggPassword) {
      setBggError(t("usuarios:profile.bggEnterPassword"));
      return;
    }
    setBggBusy(true);
    setBggError("");
    try {
      await connectBgg(bggPassword);
      await refreshUser();
      setBggPassword("");
      addToast({
        type: "bgwatch_connected",
        bggUsername: user.bggUsername,
      });
    } catch (err) {
      setBggError(bggConnectErrorMessage(err, { brandName }));
    } finally {
      setBggBusy(false);
    }
  };

  const handleBggSync = async () => {
    setSyncBusy(true);
    setSyncError("");
    setSyncSuccess("");
    try {
      const data = await syncBgg();
      await refreshUser();
      const changes = [];
      if (data.inserted)
        changes.push(t("usuarios:profile.syncNew", { count: data.inserted }));
      if (data.updated)
        changes.push(
          t("usuarios:profile.syncUpdated", { count: data.updated }),
        );
      if (data.deleted)
        changes.push(
          t("usuarios:profile.syncDeleted", { count: data.deleted }),
        );
      const detail = changes.length
        ? ` (${changes.join(", ")})`
        : t("usuarios:profile.syncNoChanges");
      setSyncSuccess(
        t("usuarios:profile.syncReconciled", { total: data.total, detail }),
      );
    } catch (err) {
      setSyncError(bggSyncErrorMessage(err));
    } finally {
      setSyncBusy(false);
    }
  };

  const handleBggDisconnect = async () => {
    if (!window.confirm(t("usuarios:profile.bggDisconnectConfirm"))) return;
    setBggBusy(true);
    setBggError("");
    try {
      await disconnectBgg();
      await refreshUser();
    } catch (err) {
      setBggError(
        err.response?.data?.message ||
          t("usuarios:profile.bggDisconnectError"),
      );
    } finally {
      setBggBusy(false);
    }
  };

  const handleAvatarPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError("");
    if (!AVATAR_MIME.includes(file.type)) {
      setAvatarError(t("usuarios:profile.avatarBadType"));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError(t("usuarios:profile.avatarTooBig"));
      return;
    }
    setAvatarFile(file);
  };

  const handleAvatarConfirm = async (blob) => {
    setAvatarBusy(true);
    setAvatarError("");
    try {
      const formData = new FormData();
      formData.append("avatar", blob, "avatar.jpg");
      await uploadAvatar(formData);
      await refreshUser();
      setAvatarFile(null);
    } catch (err) {
      setAvatarError(
        err.response?.data?.message || t("usuarios:profile.avatarUploadError"),
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarCancel = () => {
    setAvatarFile(null);
  };

  const handleAvatarRemove = async () => {
    if (!window.confirm(t("usuarios:profile.avatarRemoveConfirm"))) return;
    setAvatarBusy(true);
    setAvatarError("");
    try {
      await removeAvatar();
      await refreshUser();
    } catch (err) {
      setAvatarError(
        err.response?.data?.message || t("usuarios:profile.avatarRemoveError"),
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  // Color de la inicial cuando no hay foto. Persiste al instante (no espera al
  // submit del perfil); updateProfile reemplaza al user y el <Avatar> se
  // re-renderiza solo. "" vuelve al color automático (hasheado del _id).
  const handleAvatarColor = async (token) => {
    setAvatarBusy(true);
    setAvatarError("");
    try {
      await updateProfile({ avatarColor: token });
    } catch (err) {
      setAvatarError(
        err.response?.data?.message || t("usuarios:profile.avatarColorError"),
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  // El form está "sucio" si algún campo guardable difiere de lo guardado en el
  // usuario. El botón Guardar se deshabilita cuando no hay cambios. (El avatar,
  // su color, el tema, el push y la conexión BGG se guardan por su cuenta — no
  // cuentan acá.)
  const isDirty =
    !!user &&
    (form.displayName !== (user.displayName || "") ||
      form.nombre !== (user.nombre || "") ||
      form.apellido !== (user.apellido || "") ||
      form.telegram !== (user.telegram || "") ||
      form.celular !== (user.celular || "") ||
      form.bggUsername !== (user.bggUsername || "") ||
      form.direccionTexto !== (user.direccion?.texto || "") ||
      form.lat !== (user.direccion?.lat ?? null) ||
      form.lng !== (user.direccion?.lng ?? null) ||
      Number(form.eventoReminderHours) !== (user.eventoReminderHours ?? 24));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isDirty) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateProfile({
        displayName: form.displayName,
        nombre: form.nombre,
        apellido: form.apellido,
        telegram: form.telegram,
        celular: form.celular,
        bggUsername: form.bggUsername,
        direccion: {
          texto: form.direccionTexto,
          lat: form.lat,
          lng: form.lng,
        },
        eventoReminderHours: Number(form.eventoReminderHours),
      });
      setSuccess(t("usuarios:profile.profileSavedOk"));
      clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(
        err.response?.data?.message || t("usuarios:profile.profileSaveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Secciones (orden del diseño). Las condicionales (push/bgg) se filtran;
  // los números 01..N y el rail se derivan de las visibles. ──
  const sectionDefs = [
    {
      id: "apariencia",
      label: t("usuarios:profile.sections.apariencia"),
      show: true,
    },
    {
      id: "notificaciones",
      label: t("usuarios:profile.sections.notificaciones"),
      show: pushEnabled,
    },
    { id: "avatar", label: t("usuarios:profile.sections.avatar"), show: true },
    { id: "datos", label: t("usuarios:profile.sections.datos"), show: true },
    {
      id: "contacto",
      label: t("usuarios:profile.sections.contacto"),
      show: true,
    },
    {
      id: "bgg",
      label: t("usuarios:profile.sections.bgg"),
      show: bgwatchEnabled,
    },
    {
      id: "comunidades",
      label: t("usuarios:profile.sections.comunidades"),
      show: true,
    },
    {
      id: "ubicacion",
      label: t("usuarios:profile.sections.ubicacion"),
      show: true,
    },
    {
      id: "recordatorios",
      label: t("usuarios:profile.sections.recordatorios"),
      show: true,
    },
  ];
  const visibleSections = sectionDefs.filter((s) => s.show);
  const sectionNumber = (id) => {
    const i = visibleSections.findIndex((s) => s.id === id);
    return i < 0 ? "" : String(i + 1).padStart(2, "0");
  };

  const [activeSection, setActiveSection] = useState("apariencia");

  // Scrollspy vía IntersectionObserver: la sección activa es la primera (en
  // orden) cuyo tope entró en la franja superior. Robusto ante el contenedor de
  // scroll (window o .appContent) — IO no depende del target del scroll.
  const sectionVisibility = useRef({});
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const ids = visibleSections.map((s) => s.id);
    const els = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (els.length === 0) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          sectionVisibility.current[e.target.id] = e.isIntersecting;
        });
        const first = ids.find((id) => sectionVisibility.current[id]);
        if (first) setActiveSection(first);
      },
      { rootMargin: "-90px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // Re-observa cuando cambian las secciones visibles o al cargar el user
    // (aparece la sección BGG).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushEnabled, bgwatchEnabled, user?._id]);

  const jumpTo = (id) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const secHead = (id, title) => (
    <div className={styles.secHead}>
      <span className={styles.secNum}>{sectionNumber(id)}</span>
      <h2 className={styles.secTitle}>{title}</h2>
    </div>
  );

  // Avatar del hero (diseño .acctAvatar): foto del usuario si tiene una
  // asignada, si no la inicial sobre su color elegido (o el hash del id).
  const heroDisplay = getUserDisplay(user);
  const heroAvatarUrl = heroDisplay.avatar?.url;
  const heroInitials = getInitials(heroDisplay);
  const heroAvatarColor = isValidAvatarColor(heroDisplay.avatar?.color)
    ? heroDisplay.avatar.color
    : hashToBrandColor(String(heroDisplay._id || heroDisplay.username || ""));

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.hero}>
          <div
            className={styles.heroAvatar}
            style={
              heroAvatarUrl
                ? undefined
                : { background: `var(${heroAvatarColor})` }
            }
            aria-hidden="true"
          >
            {heroAvatarUrl ? (
              <img
                src={heroAvatarUrl}
                alt=""
                className={styles.heroAvatarImg}
              />
            ) : (
              heroInitials
            )}
          </div>
          <div className={styles.heroIdent}>
            <div className={styles.eyebrow}>
              <Meeple />
              {t("usuarios:profile.eyebrow")}
            </div>
            <div className={styles.titleRow}>
            <h1 className={styles.heroTitle}>@{user?.username}</h1>
            {bgwatchEnabled &&
              user?.bggUsername &&
              user?.bggConnected &&
              !user?.bggInvalid && (
                <Link
                  to={`/bg-watch/${encodeURIComponent(user.bggUsername)}`}
                  className={styles.bgWatchBadge}
                  title={t("usuarios:profile.bgWatchBadgeTitle")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2.5" />
                    <circle
                      cx="8"
                      cy="8"
                      r="1.3"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="16"
                      cy="8"
                      r="1.3"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="1.3"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="8"
                      cy="16"
                      r="1.3"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="1.3"
                      fill="currentColor"
                      stroke="none"
                    />
                  </svg>
                  <span>{t("usuarios:profile.bgWatchBadgeLabel")}</span>
                  <span className={styles.bgWatchBadgeCheck} aria-hidden="true">
                    ✓
                  </span>
                </Link>
              )}
          </div>
            <p className={styles.heroSub}>{user?.email}</p>
          </div>
        </div>

        <div className={styles.acctLayout}>
          <div className={styles.acctContent}>
            {error && <div className={styles.errorBox}>{error}</div>}

            {bgwatchEnabled &&
              user &&
              !user.bggUsername &&
              !bgWatchBannerDismissed && (
                <div className={styles.bgWatchBanner}>
              <span className={styles.bgWatchBannerIcon} aria-hidden="true">
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
                  <circle
                    cx="8"
                    cy="8"
                    r="1.3"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="16"
                    cy="8"
                    r="1.3"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="1.3"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="8"
                    cy="16"
                    r="1.3"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="1.3"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </span>
              <div className={styles.bgWatchBannerBody}>
                <strong className={styles.bgWatchBannerTitle}>
                  {t("usuarios:profile.bgWatchBannerTitle")}
                </strong>
                <p className={styles.bgWatchBannerSub}>
                  {t("usuarios:profile.bgWatchBannerSub", { brand: brandName })}
                </p>
              </div>
              <a
                href="#bgg-username-field"
                className={styles.bgWatchBannerCta}
                onClick={handleFocusBggField}
              >
                {t("usuarios:profile.bgWatchBannerCta")}
              </a>
              <button
                type="button"
                className={styles.bgWatchBannerDismiss}
                onClick={handleDismissBgWatchBanner}
                aria-label={t("usuarios:profile.bgWatchBannerDismissAria")}
                title={t("usuarios:profile.bgWatchBannerDismissTitle")}
              >
                ✕
              </button>
            </div>
          )}

            {bgwatchEnabled &&
              user?.bggUsername &&
              user?.bggConnected &&
              !user?.bggInvalid && (
                <MiBgWatchCard
                  bggUsername={user.bggUsername}
                  avatarUrl={user?.avatar?.url}
                />
              )}

            <form
              id="perfilForm"
              onSubmit={handleSubmit}
              className={styles.form}
            >
              <div className={styles.sec} id="apariencia">
                {secHead("apariencia", t("usuarios:profile.appearanceHead"))}
              <p className={styles.hint}>
                {t("usuarios:profile.appearanceHint", { brand: brandName })}
              </p>
              <div
                className={styles.themeToggle}
                role="group"
                aria-label={t("usuarios:profile.themeAria")}
              >
                <button
                  type="button"
                  className={`${styles.themeOption} ${theme === "dark" ? styles.themeOptionActive : ""}`}
                  onClick={() => setTheme("dark")}
                  aria-pressed={theme === "dark"}
                >
                  <MoonIcon />
                  {t("usuarios:profile.themeDark")}
                </button>
                <button
                  type="button"
                  className={`${styles.themeOption} ${theme === "light" ? styles.themeOptionActive : ""}`}
                  onClick={() => setTheme("light")}
                  aria-pressed={theme === "light"}
                >
                  <SunIcon />
                  {t("usuarios:profile.themeLight")}
                </button>
              </div>

              <p className={styles.hint}>{t("common:language.hint")}</p>
              <div
                className={styles.themeToggle}
                role="group"
                aria-label={t("common:language.label")}
              >
                <button
                  type="button"
                  className={`${styles.themeOption} ${lang === "es" ? styles.themeOptionActive : ""}`}
                  onClick={() => changeLanguage("es")}
                  aria-pressed={lang === "es"}
                >
                  Español
                </button>
                <button
                  type="button"
                  className={`${styles.themeOption} ${lang === "en" ? styles.themeOptionActive : ""}`}
                  onClick={() => changeLanguage("en")}
                  aria-pressed={lang === "en"}
                >
                  English
                </button>
              </div>
            </div>

              {pushEnabled && (
                <div className={styles.sec} id="notificaciones">
                  {secHead("notificaciones", t("usuarios:profile.pushHead"))}
                <p className={styles.hint}>
                  {t("usuarios:profile.pushHint", { brand: brandName })}
                </p>
                {renderPushControl()}
              </div>
            )}

              <div className={styles.sec} id="avatar">
                {secHead("avatar", t("usuarios:profile.avatarHead"))}
              <p className={styles.hint}>
                {t("usuarios:profile.avatarHint")}
              </p>
              <div className={styles.avatarRow}>
                <Avatar user={user} size="xl" />
                <div className={styles.avatarActions}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarBusy}
                  >
                    {user?.avatar?.url
                      ? t("usuarios:profile.avatarChange")
                      : t("usuarios:profile.avatarUpload")}
                  </button>
                  {user?.avatar?.url && (
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={handleAvatarRemove}
                      disabled={avatarBusy}
                    >
                      {t("usuarios:profile.avatarRemove")}
                    </button>
                  )}
                </div>
              </div>
              {avatarError && (
                <div className={styles.avatarError}>{avatarError}</div>
              )}
              {!user?.avatar?.url && (
                <div className={styles.avatarColorBlock}>
                  <div className={styles.sectionLabel}>
                    {t("usuarios:profile.avatarColorLabel")}
                  </div>
                  <p className={styles.hint}>
                    {t("usuarios:profile.avatarColorHint")}
                  </p>
                  <AvatarColorPicker
                    value={user?.avatar?.color || ""}
                    onChange={handleAvatarColor}
                    initial={getInitials(getUserDisplay(user))}
                    autoColor={hashToBrandColor(
                      String(user?._id || user?.username || ""),
                    )}
                    allowAuto
                    disabled={avatarBusy}
                  />
                </div>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarPick}
                style={{ display: "none" }}
              />
            </div>

              <div className={styles.sec} id="datos">
                {secHead("datos", t("usuarios:profile.datosHead"))}

              <div className={styles.field}>
                <label className={styles.label}>
                  {t("usuarios:profile.displayNameLabel")}
                </label>
                <input
                  className={styles.input}
                  name="displayName"
                  value={form.displayName}
                  onChange={handleChange}
                  placeholder={t("usuarios:profile.displayNamePlaceholder")}
                  maxLength={60}
                />
              </div>

              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    {t("usuarios:profile.nombreLabel")}
                  </label>
                  <input
                    className={styles.input}
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder={t("usuarios:profile.nombrePlaceholder")}
                    maxLength={50}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    {t("usuarios:profile.apellidoLabel")}
                  </label>
                  <input
                    className={styles.input}
                    name="apellido"
                    value={form.apellido}
                    onChange={handleChange}
                    placeholder={t("usuarios:profile.apellidoPlaceholder")}
                    maxLength={50}
                  />
                </div>
              </div>
            </div>

              <div className={styles.sec} id="contacto">
                {secHead("contacto", t("usuarios:profile.contactoHead"))}

              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    {t("usuarios:profile.telegramLabel")}
                  </label>
                  <div className={styles.inputPrefix}>
                    <span className={styles.prefix}>@</span>
                    <input
                      className={`${styles.input} ${styles.inputWithPrefix}`}
                      name="telegram"
                      value={form.telegram}
                      onChange={handleChange}
                      placeholder={t("usuarios:profile.telegramPlaceholder")}
                      maxLength={50}
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    {t("usuarios:profile.celularLabel")}
                  </label>
                  <input
                    className={styles.input}
                    name="celular"
                    value={form.celular}
                    onChange={handleChange}
                    placeholder={t("usuarios:profile.celularPlaceholder")}
                    maxLength={30}
                    type="tel"
                  />
                </div>
              </div>

              {bgwatchEnabled && (
                <div
                  className={styles.field}
                  id="bgg-username-field"
                  ref={bggFieldRef}
                >
                  <label className={styles.label}>
                    {t("usuarios:profile.bggUsernameLabel")}
                  </label>
                  <div className={styles.inputPrefix}>
                    <span className={styles.prefix}>BGG</span>
                    <input
                      ref={bggInputRef}
                      className={`${styles.input} ${styles.inputWithPrefix}`}
                      name="bggUsername"
                      value={form.bggUsername}
                      onChange={handleChange}
                      placeholder={t("usuarios:profile.bggUsernamePlaceholder")}
                      maxLength={50}
                    />
                  </div>
                </div>
              )}
            </div>

              {bgwatchEnabled && (
                <div className={styles.sec} id="bgg">
                  {secHead("bgg", t("usuarios:profile.bggHead"))}
                <p className={styles.hint}>
                  {t("usuarios:profile.bggHint", { brand: brandName })}
                </p>

                <div className={styles.bggWarning}>
                  {t("usuarios:profile.bggWarning")}
                </div>

                {bggError && <div className={styles.errorBox}>{bggError}</div>}

                {!user?.bggUsername && (
                  <p className={styles.hint}>
                    <Trans
                      i18nKey="usuarios:profile.bggConfigureUsername"
                      components={{ 1: <strong /> }}
                    />
                  </p>
                )}

                {user?.bggUsername &&
                  user?.bggConnected &&
                  !user?.bggInvalid && (
                    <>
                      <div className={styles.bggStatusGrid}>
                        <div className={styles.bggStatusCell}>
                          <span className={styles.bggStatusLabel}>
                            {t("usuarios:profile.bggConnectedAs")}
                          </span>
                          <span
                            className={`${styles.bggStatusValue} ${styles.bggStatusValueGreen}`}
                          >
                            @{user.bggUsername}
                          </span>
                        </div>
                        {user.bggConnectedAt && (
                          <div className={styles.bggStatusCell}>
                            <span className={styles.bggStatusLabel}>
                              {t("usuarios:profile.bggSince")}
                            </span>
                            <span className={styles.bggStatusValue}>
                              {new Date(user.bggConnectedAt).toLocaleDateString(
                                getLocale(),
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          </div>
                        )}
                        {user.bggSync?.lastFullSyncAt && (
                          <div className={styles.bggStatusCell}>
                            <span className={styles.bggStatusLabel}>
                              {t("usuarios:profile.bggLastFullReconcile")}
                            </span>
                            <span className={styles.bggStatusValue}>
                              {relativeTime(user.bggSync.lastFullSyncAt, t)}
                              {user.bggSync.lastFullSyncCount > 0 &&
                                t("usuarios:profile.bggPlaysSuffix", {
                                  count: user.bggSync.lastFullSyncCount,
                                })}
                            </span>
                          </div>
                        )}
                        {user.bggSync?.lastProbedAt && (
                          <div className={styles.bggStatusCell}>
                            <span className={styles.bggStatusLabel}>
                              {t("usuarios:profile.bggLastProbe")}
                            </span>
                            <span className={styles.bggStatusValue}>
                              {relativeTime(user.bggSync.lastProbedAt, t)}
                              {user.bggSync.lastProbeOutcome &&
                                probeOutcomeLabel(t)[
                                  user.bggSync.lastProbeOutcome
                                ] &&
                                ` · ${probeOutcomeLabel(t)[user.bggSync.lastProbeOutcome]}`}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className={styles.bggSyncHint}>
                        {t("usuarios:profile.bggSyncHint")}
                      </p>
                      <div className={styles.bggActions}>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={handleBggSync}
                          disabled={syncBusy || bggBusy}
                          title={t("usuarios:profile.bggSyncButtonTitle")}
                        >
                          {syncBusy ? (
                            t("usuarios:profile.bggReconciling")
                          ) : (
                            <>
                              <RefreshIcon />
                              {t("usuarios:profile.bggReconcileAll")}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={handleBggDisconnect}
                          disabled={bggBusy || syncBusy}
                        >
                          {t("usuarios:profile.bggDisconnect")}
                        </button>
                      </div>
                      {syncError && (
                        <div className={styles.errorBox}>{syncError}</div>
                      )}
                      {syncSuccess && (
                        <div className={styles.successBox}>{syncSuccess}</div>
                      )}
                    </>
                  )}

                {user?.bggUsername &&
                  (!user?.bggConnected || user?.bggInvalid) && (
                    <>
                      {user.bggInvalid && (
                        <div className={styles.bggInvalidBox}>
                          {t("usuarios:profile.bggInvalidBox")}
                        </div>
                      )}
                      <div className={styles.bggConnectForm}>
                        <div className={styles.field} style={{ flex: 1 }}>
                          <label className={styles.label}>
                            {t("usuarios:profile.bggPasswordLabel", {
                              username: user.bggUsername,
                            })}
                          </label>
                          <PasswordInput
                            className={styles.input}
                            value={bggPassword}
                            onChange={(e) => setBggPassword(e.target.value)}
                            placeholder={t(
                              "usuarios:profile.bggPasswordPlaceholder",
                            )}
                            autoComplete="off"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleBggConnect();
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={handleBggConnect}
                          disabled={bggBusy || !bggPassword}
                        >
                          {bggBusy
                            ? t("usuarios:profile.bggValidating")
                            : user.bggInvalid
                              ? t("usuarios:profile.bggReconnect")
                              : t("usuarios:profile.bggConnect")}
                        </button>
                      </div>
                    </>
                  )}
              </div>
            )}

              <div className={styles.sec} id="comunidades">
                {secHead("comunidades", t("usuarios:profile.comunidadesHead"))}
                <CommunityPrefs embed />
              </div>

              <div className={styles.sec} id="ubicacion">
                {secHead("ubicacion", t("usuarios:profile.ubicacionHead"))}
              <p className={styles.hint}>
                {t("usuarios:profile.ubicacionHint")}
              </p>

              <div className={styles.geocodeRow}>
                <PlaceAutocomplete
                  value={form.direccionTexto}
                  onChange={(text) =>
                    setForm((prev) => ({ ...prev, direccionTexto: text }))
                  }
                  onSelect={handlePlaceSelect}
                  placeholder={t("usuarios:profile.ubicacionPlaceholder")}
                />
                <button
                  type="button"
                  className={styles.btnSearch}
                  onClick={handleManualGeocode}
                  disabled={geocoding}
                  title={t("usuarios:profile.ubicacionSearchTitle")}
                >
                  {geocoding ? "…" : t("usuarios:profile.ubicacionSearch")}
                </button>
              </div>

              {form.lat && form.lng && (
                <p className={styles.coordsHint}>
                  📍 {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                </p>
              )}

              <AddressMap
                lat={form.lat}
                lng={form.lng}
                onChange={handleMapChange}
              />
            </div>

              <div className={styles.sec} id="recordatorios">
                {secHead(
                  "recordatorios",
                  t("usuarios:profile.recordatoriosHead"),
                )}
              <p className={styles.hint}>
                {t("usuarios:profile.recordatoriosHint")}
              </p>
              <div className={styles.formGroup}>
                <label htmlFor="eventoReminderHours" className={styles.label}>
                  {t("usuarios:profile.recordatoriosLabel")}
                </label>
                <select
                  id="eventoReminderHours"
                  name="eventoReminderHours"
                  className={styles.input}
                  value={form.eventoReminderHours}
                  onChange={handleChange}
                  disabled={saving}
                >
                  <option value={24}>
                    {t("usuarios:profile.recordatorios24h")}
                  </option>
                  <option value={2}>
                    {t("usuarios:profile.recordatorios2h")}
                  </option>
                  <option value={0}>
                    {t("usuarios:profile.recordatoriosNone")}
                  </option>
                </select>
              </div>
            </div>

              <button
                type="submit"
                aria-hidden="true"
                tabIndex={-1}
                className={styles.hiddenSubmit}
              />
            </form>
          </div>

          <Rail
            sections={visibleSections}
            active={activeSection}
            onJump={jumpTo}
            saving={saving}
            saved={!!success}
            dirty={isDirty}
            onSave={handleSubmit}
          />
        </div>
      </div>

      <AvatarCropModal
        open={!!avatarFile}
        file={avatarFile}
        onCancel={handleAvatarCancel}
        onConfirm={handleAvatarConfirm}
      />
    </div>
  );
}
