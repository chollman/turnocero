import { useEffect, useRef, useState } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import styles from './PlaceAutocomplete.module.css';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

/**
 * Lógica interna: requiere estar adentro de un <APIProvider>.
 * Usa Places API (New) con session token (autocompletes gratis hasta que
 * se confirma con un GetPlace).
 */
function AutocompleteCore({ value, onChange, onSelect, placeholder, disabled }) {
  const places = useMapsLibrary('places');
  const sessionTokenRef = useRef(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  // Crear (o recrear, después de un pick) el session token.
  useEffect(() => {
    if (places && !sessionTokenRef.current) {
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    }
  }, [places]);

  // Cleanup del debounce al desmontar.
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Cerrar el dropdown si se hace click fuera.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const fetchSuggestions = async (input) => {
    if (!places) return;
    try {
      const { suggestions: results } =
        await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['ar'],
          language: 'es',
        });
      setSuggestions(results || []);
      setOpen(true);
      setHighlighted(-1);
    } catch {
      setSuggestions([]);
      setOpen(false);
    }
  };

  const handleChange = (e) => {
    const text = e.target.value;
    onChange?.(text);
    clearTimeout(debounceRef.current);
    if (text.trim().length < MIN_CHARS || !places) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(text), DEBOUNCE_MS);
  };

  const handlePick = async (suggestion) => {
    setOpen(false);
    setSuggestions([]);
    if (!places || !suggestion?.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({ fields: ['location', 'formattedAddress', 'id'] });
      const loc = place.location;
      if (loc) {
        const formatted = place.formattedAddress || '';
        onSelect?.({
          lat: loc.lat(),
          lng: loc.lng(),
          formattedAddress: formatted,
          placeId: place.id,
        });
        onChange?.(formatted);
      }
    } catch {
      // Silencio — el usuario puede reintentar.
    } finally {
      // Reset session token: terminó la "sesión" billable.
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    }
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = highlighted >= 0 ? suggestions[highlighted] : suggestions[0];
      if (pick) handlePick(pick);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <input
        type="text"
        className={styles.input}
        value={value || ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {open && suggestions.length > 0 && (
        <ul className={styles.dropdown} role="listbox">
          {suggestions.map((s, i) => {
            const pred = s.placePrediction;
            const main = pred?.mainText?.text || pred?.text?.text || '';
            const secondary = pred?.secondaryText?.text || '';
            return (
              <li
                key={pred?.placeId || i}
                role="option"
                aria-selected={i === highlighted}
                className={`${styles.option} ${i === highlighted ? styles.optionActive : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // evita perder foco antes del click
                  handlePick(s);
                }}
                onMouseEnter={() => setHighlighted(i)}
              >
                <span className={styles.optionMain}>{main}</span>
                {secondary && <span className={styles.optionSecondary}>{secondary}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * PlaceAutocomplete — input con sugerencias de Google Places (sesgo a Argentina).
 *
 * Props:
 *   value         string                — texto actual (controlado)
 *   onChange      (text) => void        — cambios en el input (incluido al picar)
 *   onSelect      ({lat,lng,formattedAddress,placeId}) => void — usuario picó
 *   placeholder   string
 *   disabled      boolean
 *
 * Se envuelve en su propio APIProvider; si ya hay uno arriba, vis.gl lo deduplica.
 */
export default function PlaceAutocomplete(props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <input
        type="text"
        className={styles.input}
        value={props.value || ''}
        onChange={(e) => props.onChange?.(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
      />
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={['places']}>
      <AutocompleteCore {...props} />
    </APIProvider>
  );
}
