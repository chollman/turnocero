import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import MiBgWatchCard from './MiBgWatchCard';
import styles from './UserProfile.module.css';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

const buildMarkerIcon = () => {
  const amber = getComputedStyle(document.documentElement).getPropertyValue('--amber').trim() || '#1888ef';
  const ring = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#ffffff';
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;background:${amber};border:3px solid ${ring};border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

export default function UserProfile() {
  const { user, updateProfile, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();

  // ── BGG connection state ──
  const [bggPassword, setBggPassword] = useState('');
  const [bggBusy, setBggBusy] = useState(false);
  const [bggError, setBggError] = useState('');

  const [form, setForm] = useState({
    displayName: '',
    nombre: '',
    apellido: '',
    telegram: '',
    celular: '',
    bggUsername: '',
    direccionTexto: '',
    lat: null,
    lng: null,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const updateMarkerRef = useRef(null);
  const errorTimerRef = useRef(null);
  const successTimerRef = useRef(null);

  useEffect(() => () => {
    clearTimeout(errorTimerRef.current);
    clearTimeout(successTimerRef.current);
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm({
      displayName: user.displayName || '',
      nombre: user.nombre || '',
      apellido: user.apellido || '',
      telegram: user.telegram || '',
      celular: user.celular || '',
      bggUsername: user.bggUsername || '',
      direccionTexto: user.direccion?.texto || '',
      lat: user.direccion?.lat ?? null,
      lng: user.direccion?.lng ?? null,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center = (user?.direccion?.lat && user?.direccion?.lng)
      ? [user.direccion.lat, user.direccion.lng]
      : [-34.6037, -58.3816];

    const map = L.map(mapContainerRef.current, { center, zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;

    const placeMarker = (lat, lng) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const m = L.marker([lat, lng], { icon: buildMarkerIcon(), draggable: true }).addTo(map);
        m.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          setForm((prev) => ({ ...prev, lat: pos.lat, lng: pos.lng }));
        });
        markerRef.current = m;
      }
      map.setView([lat, lng], 15);
      setForm((prev) => ({ ...prev, lat, lng }));
    };

    updateMarkerRef.current = placeMarker;

    if (user?.direccion?.lat && user?.direccion?.lng) {
      placeMarker(user.direccion.lat, user.direccion.lng);
    }

    map.on('click', (e) => placeMarker(e.latlng.lat, e.latlng.lng));

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setIcon(buildMarkerIcon());
    }
  }, [theme]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGeocode = async () => {
    if (!form.direccionTexto.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(
        `${NOMINATIM}?format=json&q=${encodeURIComponent(form.direccionTexto)}&limit=1`,
        { headers: { 'Accept-Language': 'es' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        updateMarkerRef.current?.(parseFloat(data[0].lat), parseFloat(data[0].lon));
      } else {
        setError('No se encontró la dirección. Intentá ser más específico.');
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => setError(''), 3000);
      }
    } catch {
      setError('Error al buscar la dirección.');
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(''), 3000);
    } finally {
      setGeocoding(false);
    }
  };

  const handleBggConnect = async () => {
    if (!user?.bggUsername) {
      setBggError('Configurá primero tu username de BGG y guardá el perfil.');
      return;
    }
    if (!bggPassword) {
      setBggError('Ingresá tu password de BGG.');
      return;
    }
    setBggBusy(true);
    setBggError('');
    try {
      await axios.post('/api/auth/bgg-connect', { password: bggPassword });
      await refreshUser();
      setBggPassword('');
    } catch (err) {
      setBggError(err.response?.data?.message || 'No se pudo conectar con BGG.');
    } finally {
      setBggBusy(false);
    }
  };

  const handleBggDisconnect = async () => {
    if (!window.confirm('¿Desconectar tu cuenta de BGG? Vas a tener que reingresar tu password para volver a cargar partidas.')) return;
    setBggBusy(true);
    setBggError('');
    try {
      await axios.delete('/api/auth/bgg-connection');
      await refreshUser();
    } catch (err) {
      setBggError(err.response?.data?.message || 'Error al desconectar.');
    } finally {
      setBggBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
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
      });
      setSuccess('Perfil guardado correctamente.');
      clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}>◆ MI PERFIL</div>
          <h1 className={styles.heroTitle}>@{user?.username}</h1>
          <p className={styles.heroSub}>{user?.email}</p>
        </div>

        {user?.bggUsername && user?.bggConnected && !user?.bggInvalid && (
          <MiBgWatchCard bggUsername={user.bggUsername} />
        )}

        <div className={styles.formCard}>
          {error && <div className={styles.errorBox}>{error}</div>}
          {success && <div className={styles.successBox}>{success}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Apariencia</div>
              <p className={styles.hint}>
                Elegí cómo querés ver Turnocero. Tu preferencia se guarda en este dispositivo.
              </p>
              <div className={styles.themeToggle} role="group" aria-label="Tema">
                <button
                  type="button"
                  className={`${styles.themeOption} ${theme === 'dark' ? styles.themeOptionActive : ''}`}
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  <MoonIcon />
                  Oscuro
                </button>
                <button
                  type="button"
                  className={`${styles.themeOption} ${theme === 'light' ? styles.themeOptionActive : ''}`}
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                >
                  <SunIcon />
                  Claro
                </button>
              </div>
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

              <div className={styles.field}>
                <label className={styles.label}>Usuario en BGG</label>
                <div className={styles.inputPrefix}>
                  <span className={styles.prefix}>BGG</span>
                  <input
                    className={`${styles.input} ${styles.inputWithPrefix}`}
                    name="bggUsername"
                    value={form.bggUsername}
                    onChange={handleChange}
                    placeholder="tu_usuario_bgg"
                    maxLength={50}
                  />
                </div>
              </div>
            </div>

            <div className={styles.section} id="conexion-bgg">
              <div className={styles.sectionLabel}>Conexión con BoardGameGeek</div>
              <p className={styles.hint}>
                Conectá tu cuenta de BGG para cargar, editar y eliminar partidas
                directamente desde Turnocero. Tu password se guarda cifrada
                (AES-256-GCM) en nuestros servidores y nunca se envía al navegador.
              </p>

              <div className={styles.bggWarning}>
                ⚠️ Usamos el endpoint interno de BGG (no oficial). Si BGG cambia su
                web, esta integración puede dejar de funcionar hasta una
                actualización. Podés desconectar cuando quieras.
              </div>

              {bggError && <div className={styles.errorBox}>{bggError}</div>}

              {!user?.bggUsername && (
                <p className={styles.hint}>
                  Primero configurá tu <strong>Usuario en BGG</strong> arriba y
                  guardá el perfil.
                </p>
              )}

              {user?.bggUsername && user?.bggConnected && !user?.bggInvalid && (
                <div className={styles.bggStatus}>
                  <div className={styles.bggStatusBlock}>
                    <span className={styles.bggStatusLabel}>Conectado como</span>
                    <span className={styles.bggStatusValue}>@{user.bggUsername}</span>
                  </div>
                  {user.bggConnectedAt && (
                    <div className={styles.bggStatusBlock}>
                      <span className={styles.bggStatusLabel}>Desde</span>
                      <span className={styles.bggStatusValue}>
                        {new Date(user.bggConnectedAt).toLocaleDateString('es-AR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={handleBggDisconnect}
                    disabled={bggBusy}
                  >
                    Desconectar
                  </button>
                </div>
              )}

              {user?.bggUsername && (!user?.bggConnected || user?.bggInvalid) && (
                <>
                  {user.bggInvalid && (
                    <div className={styles.bggInvalidBox}>
                      Tu sesión BGG caducó (probablemente cambiaste el password en
                      BGG.com). Reingresá tu password para reconectar.
                    </div>
                  )}
                  <div className={styles.bggConnectForm}>
                    <div className={styles.field} style={{ flex: 1 }}>
                      <label className={styles.label}>
                        Password de BGG para @{user.bggUsername}
                      </label>
                      <input
                        type="password"
                        className={styles.input}
                        value={bggPassword}
                        onChange={(e) => setBggPassword(e.target.value)}
                        placeholder="Tu password de BoardGameGeek"
                        autoComplete="off"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleBggConnect(); } }}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={handleBggConnect}
                      disabled={bggBusy || !bggPassword}
                    >
                      {bggBusy ? 'Validando…' : (user.bggInvalid ? 'Reconectar' : 'Conectar')}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionLabel}>Dirección</div>
              <p className={styles.hint}>
                Escribí tu dirección y hacé clic en <strong>Buscar</strong>, o cliqueá directamente en el mapa para marcar tu ubicación.
              </p>

              <div className={styles.geocodeRow}>
                <input
                  className={styles.input}
                  name="direccionTexto"
                  value={form.direccionTexto}
                  onChange={handleChange}
                  placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
                />
                <button
                  type="button"
                  className={styles.btnSearch}
                  onClick={handleGeocode}
                  disabled={geocoding}
                >
                  {geocoding ? '…' : 'Buscar'}
                </button>
              </div>

              {form.lat && form.lng && (
                <p className={styles.coordsHint}>
                  📍 {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                </p>
              )}

              <div ref={mapContainerRef} className={styles.map} />
            </div>

            <div className={styles.actions}>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
