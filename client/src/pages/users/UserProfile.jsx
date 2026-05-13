import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import styles from './UserProfile.module.css';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

const markerIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;background:#1888ef;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.6)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function UserProfile() {
  const { user, updateProfile } = useAuth();

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
        const m = L.marker([lat, lng], { icon: markerIcon, draggable: true }).addTo(map);
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

        <div className={styles.formCard}>
          {error && <div className={styles.errorBox}>{error}</div>}
          {success && <div className={styles.successBox}>{success}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
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
