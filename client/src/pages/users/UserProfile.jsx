import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useTheme } from "../../context/ThemeContext";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import { API } from "../../api/endpoints";
import MiBgWatchCard from "./MiBgWatchCard";
import CommunityPrefs from "./CommunityPrefs";
import Avatar from "../../components/shared/Avatar";
import AvatarCropModal from "../../components/shared/AvatarCropModal";
import AvatarColorPicker from "../../components/shared/AvatarColorPicker";
import { hashToBrandColor } from "../../utils/hash";
import { getInitials } from "../../utils/initials";
import { getUserDisplay } from "../../utils/userDisplay";
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

const PROBE_OUTCOME_LABEL = {
  no_drift: "✓ Sin cambios",
  edits_only: "✓ Cambios aplicados",
  reconciled: "✓ Reconciliado",
  failed: "⚠️ Falló",
};

function relativeTimeEs(date) {
  if (!date) return null;
  const diffSec = (Date.now() - new Date(date).getTime()) / 1000;
  if (diffSec < 60) return "hace un momento";
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)} h`;
  if (diffSec < 604800) return `hace ${Math.floor(diffSec / 86400)} d`;
  return new Date(date).toLocaleDateString("es-AR", {
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

export default function UserProfile() {
  const { user, updateProfile, refreshUser } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const brandName = useBrandName();
  // theme se sigue usando para Apariencia (toggle dark/light); el mapa lo lee
  // por su cuenta vía useTheme dentro de AddressMap.
  const { theme, setTheme } = useTheme();
  const { addToast } = useNotifications();
  const bgwatchEnabled = isSectionEnabled("bgwatch");
  const pushEnabled = isSectionEnabled("push");
  const push = usePushNotifications();

  const handlePushSubscribe = async () => {
    const ok = await push.subscribe();
    addToast(
      ok
        ? {
            type: "success",
            title: "¡Activadas!",
            message: "Te vamos a avisar en este dispositivo.",
          }
        : {
            type: "error",
            title: "No se pudo",
            message:
              "Revisá los permisos de notificaciones del navegador.",
          },
    );
  };

  const handlePushUnsubscribe = async () => {
    const ok = await push.unsubscribe();
    addToast(
      ok
        ? {
            type: "success",
            title: "Listo",
            message: "Desactivaste las notificaciones en este dispositivo.",
          }
        : { type: "error", title: "Ups", message: "No se pudieron desactivar." },
    );
  };

  function renderPushControl() {
    // iOS en pestaña: el push solo anda con la PWA instalada. Va PRIMERO porque
    // ahí `isSupported` es false, pero el mensaje útil es "instalá", no
    // "no soporta".
    if (push.requiresStandalone) {
      return (
        <p className={styles.hint}>
          Instalá {brandName} en tu pantalla de inicio (compartir → “Agregar a
          inicio”) para activar las notificaciones.
        </p>
      );
    }
    if (!push.isSupported) {
      return (
        <p className={styles.hint}>
          Tu navegador no soporta notificaciones push.
        </p>
      );
    }
    if (push.permission === "denied") {
      return (
        <p className={styles.hint}>
          Bloqueaste las notificaciones. Habilitalas desde la configuración del
          navegador para este sitio.
        </p>
      );
    }
    if (push.isSubscribed) {
      return (
        <button
          type="button"
          className={styles.btnGhost}
          disabled={push.busy}
          onClick={handlePushUnsubscribe}
        >
          {push.busy ? "Desactivando…" : "Desactivar notificaciones"}
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
        {push.busy ? "Activando…" : "Activar notificaciones"}
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
      setError("Escribí una dirección de al menos 3 caracteres.");
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(""), 3000);
      return;
    }
    setGeocoding(true);
    try {
      const { data } = await axios.get(API.geocode, { params: { q } });
      setForm((prev) => ({
        ...prev,
        direccionTexto: data.formatted || prev.direccionTexto,
        lat: data.lat,
        lng: data.lng,
      }));
    } catch (err) {
      const msg =
        err.response?.status === 404
          ? "No se encontró la dirección. Intentá ser más específico o picá una sugerencia."
          : err.response?.data?.message || "Error al buscar la dirección.";
      setError(msg);
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(""), 3000);
    } finally {
      setGeocoding(false);
    }
  };

  const handleBggConnect = async () => {
    if (!user?.bggUsername) {
      setBggError("Configurá primero tu username de BGG y guardá el perfil.");
      return;
    }
    if (!bggPassword) {
      setBggError("Ingresá tu password de BGG.");
      return;
    }
    setBggBusy(true);
    setBggError("");
    try {
      await axios.post(API.auth.BGG_CONNECT, { password: bggPassword });
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
      const { data } = await axios.post(API.bgg.SYNC);
      await refreshUser();
      const changes = [];
      if (data.inserted) changes.push(`${data.inserted} nuevas`);
      if (data.updated) changes.push(`${data.updated} actualizadas`);
      if (data.deleted) changes.push(`${data.deleted} borradas`);
      const detail = changes.length
        ? ` (${changes.join(", ")})`
        : " (sin cambios)";
      setSyncSuccess(`Reconciliadas ${data.total} partidas${detail}`);
    } catch (err) {
      setSyncError(bggSyncErrorMessage(err));
    } finally {
      setSyncBusy(false);
    }
  };

  const handleBggDisconnect = async () => {
    if (
      !window.confirm(
        "¿Desconectar tu cuenta de BGG? Vas a tener que reingresar tu password para volver a cargar partidas.",
      )
    )
      return;
    setBggBusy(true);
    setBggError("");
    try {
      await axios.delete(API.auth.BGG_CONNECTION);
      await refreshUser();
    } catch (err) {
      setBggError(err.response?.data?.message || "Error al desconectar.");
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
      setAvatarError("Solo se permiten imágenes JPG, PNG o WEBP.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError("La imagen no puede superar los 5 MB.");
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
      await axios.put(API.auth.AVATAR, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refreshUser();
      setAvatarFile(null);
    } catch (err) {
      setAvatarError(
        err.response?.data?.message || "Error al subir el avatar.",
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarCancel = () => {
    setAvatarFile(null);
  };

  const handleAvatarRemove = async () => {
    if (!window.confirm("¿Quitar tu avatar? Volverá a mostrarse tu inicial."))
      return;
    setAvatarBusy(true);
    setAvatarError("");
    try {
      await axios.delete(API.auth.AVATAR);
      await refreshUser();
    } catch (err) {
      setAvatarError(
        err.response?.data?.message || "Error al quitar el avatar.",
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
        err.response?.data?.message || "Error al guardar el color.",
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      setSuccess("Perfil guardado correctamente.");
      clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Error al guardar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}>
            <Meeple />
            MI PERFIL
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
                  title="Tu BG Watch está activo. Ir a mi perfil BG Watch."
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
                  <span>BG Watch</span>
                  <span className={styles.bgWatchBadgeCheck} aria-hidden="true">
                    ✓
                  </span>
                </Link>
              )}
          </div>
          <p className={styles.heroSub}>{user?.email}</p>
        </div>

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
                  ¿Llevás partidas en BoardGameGeek?
                </strong>
                <p className={styles.bgWatchBannerSub}>
                  Activá BG Watch para registrar todas tus partidas desde{" "}
                  {brandName}.
                </p>
              </div>
              <a
                href="#bgg-username-field"
                className={styles.bgWatchBannerCta}
                onClick={handleFocusBggField}
              >
                Activá ahora →
              </a>
              <button
                type="button"
                className={styles.bgWatchBannerDismiss}
                onClick={handleDismissBgWatchBanner}
                aria-label="Ocultar este banner"
                title="Ocultar"
              >
                ✕
              </button>
            </div>
          )}

        {bgwatchEnabled &&
          user?.bggUsername &&
          user?.bggConnected &&
          !user?.bggInvalid && <MiBgWatchCard bggUsername={user.bggUsername} />}

        <CommunityPrefs />

        <div className={styles.formCard}>
          {error && <div className={styles.errorBox}>{error}</div>}
          {success && <div className={styles.successBox}>{success}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Apariencia</div>
              <p className={styles.hint}>
                Elegí cómo querés ver {brandName}. Tu preferencia se guarda en
                este dispositivo.
              </p>
              <div
                className={styles.themeToggle}
                role="group"
                aria-label="Tema"
              >
                <button
                  type="button"
                  className={`${styles.themeOption} ${theme === "dark" ? styles.themeOptionActive : ""}`}
                  onClick={() => setTheme("dark")}
                  aria-pressed={theme === "dark"}
                >
                  <MoonIcon />
                  Oscuro
                </button>
                <button
                  type="button"
                  className={`${styles.themeOption} ${theme === "light" ? styles.themeOptionActive : ""}`}
                  onClick={() => setTheme("light")}
                  aria-pressed={theme === "light"}
                >
                  <SunIcon />
                  Claro
                </button>
              </div>
            </div>

            {pushEnabled && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Notificaciones push</div>
                <p className={styles.hint}>
                  Recibí un aviso en este dispositivo cuando pase algo
                  importante (un mensaje, una solicitud, un recordatorio),
                  aunque {brandName} esté cerrada.
                </p>
                {renderPushControl()}
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.sectionLabel}>Avatar</div>
              <p className={styles.hint}>
                Subí una foto cuadrada para que te identifiquen en mesas,
                comentarios y chats.
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
                    {user?.avatar?.url ? "Cambiar avatar" : "Subir avatar"}
                  </button>
                  {user?.avatar?.url && (
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={handleAvatarRemove}
                      disabled={avatarBusy}
                    >
                      Quitar avatar
                    </button>
                  )}
                </div>
              </div>
              {avatarError && (
                <div className={styles.avatarError}>{avatarError}</div>
              )}
              {!user?.avatar?.url && (
                <div className={styles.avatarColorBlock}>
                  <div className={styles.sectionLabel}>Color del avatar</div>
                  <p className={styles.hint}>
                    Mientras no subas una foto, tu inicial se muestra sobre este
                    color.
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

            <div className={styles.section}>
              <div className={styles.sectionLabel}>Información personal</div>

              <div className={styles.field}>
                <label className={styles.label}>Nombre para mostrar</label>
                <input
                  className={styles.input}
                  name="displayName"
                  value={form.displayName}
                  onChange={handleChange}
                  placeholder="Como querés que te vean otros usuarios"
                  maxLength={60}
                />
              </div>

              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label className={styles.label}>Nombre</label>
                  <input
                    className={styles.input}
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Tu nombre"
                    maxLength={50}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Apellido</label>
                  <input
                    className={styles.input}
                    name="apellido"
                    value={form.apellido}
                    onChange={handleChange}
                    placeholder="Tu apellido"
                    maxLength={50}
                  />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionLabel}>Contacto</div>

              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label className={styles.label}>Telegram</label>
                  <div className={styles.inputPrefix}>
                    <span className={styles.prefix}>@</span>
                    <input
                      className={`${styles.input} ${styles.inputWithPrefix}`}
                      name="telegram"
                      value={form.telegram}
                      onChange={handleChange}
                      placeholder="tu_usuario"
                      maxLength={50}
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Celular</label>
                  <input
                    className={styles.input}
                    name="celular"
                    value={form.celular}
                    onChange={handleChange}
                    placeholder="+54 9 11 1234-5678"
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
                  <label className={styles.label}>Usuario en BGG</label>
                  <div className={styles.inputPrefix}>
                    <span className={styles.prefix}>BGG</span>
                    <input
                      ref={bggInputRef}
                      className={`${styles.input} ${styles.inputWithPrefix}`}
                      name="bggUsername"
                      value={form.bggUsername}
                      onChange={handleChange}
                      placeholder="tu_usuario_bgg"
                      maxLength={50}
                    />
                  </div>
                </div>
              )}
            </div>

            {bgwatchEnabled && (
              <div className={styles.section} id="conexion-bgg">
                <div className={styles.sectionLabel}>
                  Conexión con BoardGameGeek
                </div>
                <p className={styles.hint}>
                  Conectá tu cuenta de BGG para cargar, editar y eliminar
                  partidas directamente desde {brandName}. Tu password se guarda
                  cifrada (AES-256-GCM) en nuestros servidores y nunca se envía
                  al navegador.
                </p>

                <div className={styles.bggWarning}>
                  ⚠️ Usamos el endpoint interno de BGG (no oficial). Si BGG
                  cambia su web, esta integración puede dejar de funcionar hasta
                  una actualización. Podés desconectar cuando quieras.
                </div>

                {bggError && <div className={styles.errorBox}>{bggError}</div>}

                {!user?.bggUsername && (
                  <p className={styles.hint}>
                    Primero configurá tu <strong>Usuario en BGG</strong> arriba
                    y guardá el perfil.
                  </p>
                )}

                {user?.bggUsername &&
                  user?.bggConnected &&
                  !user?.bggInvalid && (
                    <>
                      <div className={styles.bggStatus}>
                        <div className={styles.bggStatusBlock}>
                          <span className={styles.bggStatusLabel}>
                            Conectado como
                          </span>
                          <span className={styles.bggStatusValue}>
                            @{user.bggUsername}
                          </span>
                        </div>
                        {user.bggConnectedAt && (
                          <div className={styles.bggStatusBlock}>
                            <span className={styles.bggStatusLabel}>Desde</span>
                            <span className={styles.bggStatusValue}>
                              {new Date(user.bggConnectedAt).toLocaleDateString(
                                "es-AR",
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
                          <div className={styles.bggStatusBlock}>
                            <span className={styles.bggStatusLabel}>
                              Última reconciliación completa
                            </span>
                            <span className={styles.bggStatusValue}>
                              {relativeTimeEs(user.bggSync.lastFullSyncAt)}
                              {user.bggSync.lastFullSyncCount > 0 &&
                                ` · ${user.bggSync.lastFullSyncCount} partidas`}
                            </span>
                          </div>
                        )}
                        {user.bggSync?.lastProbedAt && (
                          <div className={styles.bggStatusBlock}>
                            <span className={styles.bggStatusLabel}>
                              Última verificación
                            </span>
                            <span className={styles.bggStatusValue}>
                              {relativeTimeEs(user.bggSync.lastProbedAt)}
                              {user.bggSync.lastProbeOutcome &&
                                PROBE_OUTCOME_LABEL[
                                  user.bggSync.lastProbeOutcome
                                ] &&
                                ` · ${PROBE_OUTCOME_LABEL[user.bggSync.lastProbeOutcome]}`}
                            </span>
                          </div>
                        )}
                        <p className={styles.bggSyncHint}>
                          Tu historial se mantiene actualizado automáticamente
                          cuando entrás a BG Watch. Apretá el botón solo si
                          editaste partidas viejas en BGG.com y querés forzar
                          una reconciliación completa ahora.
                        </p>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={handleBggSync}
                          disabled={syncBusy || bggBusy}
                          title="Walk completo del historial de BGG. Útil si editaste partidas más viejas que las 30 más recientes."
                        >
                          {syncBusy
                            ? "Reconciliando…"
                            : "↻ Reconciliar todo con BGG"}
                        </button>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={handleBggDisconnect}
                          disabled={bggBusy || syncBusy}
                        >
                          Desconectar
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
                          Tu sesión BGG caducó (probablemente cambiaste el
                          password en BGG.com). Reingresá tu password para
                          reconectar.
                        </div>
                      )}
                      <div className={styles.bggConnectForm}>
                        <div className={styles.field} style={{ flex: 1 }}>
                          <label className={styles.label}>
                            Password de BGG para @{user.bggUsername}
                          </label>
                          <PasswordInput
                            className={styles.input}
                            value={bggPassword}
                            onChange={(e) => setBggPassword(e.target.value)}
                            placeholder="Tu password de BoardGameGeek"
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
                            ? "Validando…"
                            : user.bggInvalid
                              ? "Reconectar"
                              : "Conectar"}
                        </button>
                      </div>
                    </>
                  )}
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.sectionLabel}>Dirección</div>
              <p className={styles.hint}>
                Empezá a escribir y elegí una opción del menú, o cliqueá
                directamente en el mapa para marcar tu ubicación.
              </p>

              <div className={styles.geocodeRow}>
                <PlaceAutocomplete
                  value={form.direccionTexto}
                  onChange={(text) =>
                    setForm((prev) => ({ ...prev, direccionTexto: text }))
                  }
                  onSelect={handlePlaceSelect}
                  placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
                />
                <button
                  type="button"
                  className={styles.btnSearch}
                  onClick={handleManualGeocode}
                  disabled={geocoding}
                  title="Buscar la dirección que tipeaste (si no querés usar las sugerencias)"
                >
                  {geocoding ? "…" : "Buscar"}
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

            <div className={styles.section}>
              <div className={styles.sectionLabel}>
                Recordatorios de eventos
              </div>
              <p className={styles.hint}>
                Cuándo querés que te avisemos sobre los eventos donde estás
                inscripto. Aplica solo a eventos pagos o con cupo confirmado.
              </p>
              <div className={styles.formGroup}>
                <label htmlFor="eventoReminderHours" className={styles.label}>
                  Avisarme
                </label>
                <select
                  id="eventoReminderHours"
                  name="eventoReminderHours"
                  className={styles.input}
                  value={form.eventoReminderHours}
                  onChange={handleChange}
                  disabled={saving}
                >
                  <option value={24}>24 horas antes</option>
                  <option value={2}>2 horas antes</option>
                  <option value={0}>No quiero recordatorios</option>
                </select>
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>
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
