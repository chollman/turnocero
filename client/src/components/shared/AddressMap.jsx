import { useEffect, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from "@vis.gl/react-google-maps";
import { Trans, useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import styles from "./AddressMap.module.css";

// Default center: Obelisco, CABA.
const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

/**
 * Sync helper: cuando cambian las coords desde afuera (ej. el usuario eligió
 * algo del autocomplete), centramos el mapa en el nuevo punto.
 */
function MapSync({ lat, lng }) {
  const map = useMap();
  const lastRef = useRef({ lat: null, lng: null });

  useEffect(() => {
    if (!map || lat == null || lng == null) return;
    const last = lastRef.current;
    if (last.lat === lat && last.lng === lng) return;
    lastRef.current = { lat, lng };
    map.panTo({ lat, lng });
    if ((map.getZoom() || 0) < 14) map.setZoom(15);
  }, [map, lat, lng]);

  return null;
}

/**
 * AddressMap — mapa de Google con marker arrastrable.
 *
 * - Click en el mapa = mueve / coloca el marker en ese punto.
 * - Drag del marker  = actualiza coords.
 * - Si `lat`/`lng` cambian desde afuera, el mapa hace pan a esa coord.
 * - El estilo (dark/light) se toma del ThemeContext vía mapId.
 *
 * Props:
 *   lat, lng   number|null — coordenadas actuales (marker se oculta si null)
 *   onChange   (lat, lng) => void — llamado cuando el usuario interactúa
 *   height     number      — alto del mapa en px (default 280)
 */
export default function AddressMap({ lat, lng, onChange, height = 280 }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  // Leer envs en cada render — permite override en tests vía vi.stubEnv y se
  // mantiene barato porque import.meta.env es un objeto sincrónico.
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapIdDark = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID_DARK;
  const mapIdLight = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID_LIGHT;
  const mapId = theme === "light" ? mapIdLight : mapIdDark;

  if (!apiKey) {
    return (
      <div className={styles.map} style={{ height }} role="alert">
        <p className={styles.error}>
          <Trans
            i18nKey="shared:addressMap.missingKey"
            components={[<span key="0" />, <code key="1" />]}
          />
        </p>
      </div>
    );
  }

  const hasMarker = lat != null && lng != null;
  const center = hasMarker ? { lat, lng } : DEFAULT_CENTER;

  return (
    <div className={styles.map} style={{ height }}>
      <APIProvider apiKey={apiKey}>
        <Map
          // key={mapId} fuerza un remount cuando cambia el tema. Google Maps
          // solo acepta `mapId` al construir el mapa — sin remount, el primer
          // estilo queda fijo aunque cambien las props.
          key={mapId}
          mapId={mapId}
          // colorScheme es obligatorio cuando el Map Style usa el nuevo sistema
          // "tipado" (Style type = Light/Dark). Sin esto, los styles tipo Dark
          // no se aplican aunque el Map ID esté correctamente asociado.
          colorScheme={theme === "light" ? "LIGHT" : "DARK"}
          defaultCenter={center}
          defaultZoom={hasMarker ? 15 : 13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          clickableIcons={false}
          onClick={(e) => {
            const ll = e.detail?.latLng;
            if (ll) onChange?.(ll.lat, ll.lng);
          }}
        >
          <MapSync lat={lat} lng={lng} />
          {hasMarker && (
            <AdvancedMarker
              position={{ lat, lng }}
              draggable
              onDragEnd={(e) => {
                const ll = e.latLng;
                if (ll) onChange?.(ll.lat(), ll.lng());
              }}
            >
              <span
                className={styles.pin}
                aria-label={t("shared:addressMap.markerLabel")}
              />
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
