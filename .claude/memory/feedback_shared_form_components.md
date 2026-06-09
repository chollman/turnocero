---
name: feedback-shared-form-components
description: 'Catalog of shared form components extracted from EventoForm — `<InfoTooltip>`, `<DateTimePicker>`, `<PasswordInput>` (eye toggle), status chips (radiogroup); BGG error mappers (utils/bggErrors.js); conventions for height/radius/placeholder; "validate only in handleSubmit, never HTML required" rule'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 92c9193d-d562-4786-a099-944475d22163
---

# Componentes shared de formularios (2026-05)

A medida que el EventoForm fue iterando, se extrajeron componentes shared reutilizables. Catálogo + reglas de uso:

## `<InfoTooltip>` (`components/shared/InfoTooltip.jsx`)

Ícono `ⓘ` SVG (Feather-style, `currentColor=--amber`) inline que muestra un tooltip flotante con el contenido al hacer hover / click / focus. Cerrá con click-outside o Escape.

**Uso**:

```jsx
<label>
  Mi campo
  <InfoTooltip label="Ayuda sobre mi campo">
    Explicación del campo, con <strong>HTML</strong> permitido.
  </InfoTooltip>
</label>
```

**Gotchas**:

- El `label` (aria-label del trigger button) NO debe contener literalmente el texto del label del campo — `getByLabelText(/lugar/i)` matcheaba tanto el input como el InfoTooltip button. Usar regex stricto `/^lugar$/i` o un aria-label genérico tipo "Más información".
- Trigger es `<button type="button">` — labellable y accesible.
- Default ícono color = `var(--amber)` (legacy naming: el `--amber` de Turnocero en realidad es **azul** brand #1888ef, NO amber).

## `<DateTimePicker>` (`components/shared/DateTimePicker.jsx`)

Picker custom con popover propio — **NO usa el `<input type="datetime-local">` nativo del browser** (el picker del SO se ve viejo y rompe la estética).

**UI**:

- Trigger: `<button>` que muestra "Vie 13 Jun · 20:00 ▾" o "Elegí fecha y hora".
- Popover con: month nav (← / →) + grid 6×7 (semana arranca lunes AR) + time row (selects HH:MM).
- Días pasados: disabled + opacidad reducida.
- Día seleccionado: bg amber + box-shadow glow.
- Hoy: outline amber.

**Auto-posicionamiento up/down**: al abrir, mide `triggerRef.getBoundingClientRect()` y `window.innerHeight`. Si no entra abajo (`spaceBelow < POPOVER_HEIGHT_PX`) Y hay más espacio arriba, aplica clase `.popoverUp` (anclado al `bottom: calc(100% + 6px)`).

**Modo `dateOnly` + restricciones de fecha (2026-06)**: props opt-in, backward-compatible (defaults preservan el comportamiento datetime de Mesas/Eventos/Torneos):

- `dateOnly` — oculta la time row; `value`/`onChange` usan `"YYYY-MM-DD"` (parseado como fecha **LOCAL** para evitar el off-by-one de `new Date("YYYY-MM-DD")`, que parsea en UTC). Elegir un día emite y cierra el popover. Trigger: "Vie 13 Jun" / "Elegí fecha".
- `allowPast` — por **default el picker BLOQUEA días pasados** (está pensado para agendar eventos futuros). Pasalo para permitir el pasado (ej. cargar una partida YA jugada en BG Watch).
- `maxDate` (Date | "YYYY-MM-DD") — deshabilita días posteriores (ej. `hoy`, para que una partida no quede en el futuro).

Combinación BG Watch (`PlayForm`): `dateOnly allowPast maxDate={hoy}`. Mantené la validación JS backstop (un value futuro puede llegar por borrador restaurado / initialValues).

**Compatibilidad con forms**:

- Trigger lleva el `id` principal (es labellable como `<button>`).
- Hidden `<input type="hidden" name>` para que el FormData del form padre incluya el value.
- `required` se forwardea como `aria-required` (NUNCA como HTML `required` — el browser nativo bloquearía el submit y nunca llegaría a la validación JS amigable del handleSubmit).

**Test mocking**: en tests del form padre, mockear DateTimePicker como input regular para evitar tener que clickear el popover:

```js
vi.mock("../../components/shared/DateTimePicker", () => ({
  default: ({ value, onChange, id, name, required }) => (
    <input
      id={id}
      name={name}
      type="datetime-local"
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      aria-required={required || undefined}
    />
  ),
}));
```

## `<PasswordInput>` (`components/shared/PasswordInput.jsx`)

Input de contraseña con el típico **ojito** de mostrar/ocultar (SVG inline Eye/EyeOff, sin libs). Toggle interno (`useState show`), el botón es `<button type="button" tabIndex={-1}>` (fuera del orden de Tab) con `aria-label` "Mostrar/Ocultar contraseña". Vive en `components/shared/` desde 2026-06 (antes estaba en `pages/auth/`, se movió al reusarse en `/perfil` para la conexión BGG).

**Props**: `id, name, value, onChange, onKeyDown, placeholder, required, minLength, className, autoComplete`. Pasale `className={styles.input}` del form propio — el wrap se posiciona solo (relative + el botón absolute a la derecha; agrega `paddingRight` al input para no tapar el texto). `onKeyDown` está forwardeado (ej. Enter→submit en el form de BGG).

**Usado en**: Login/Register/ResetPassword (auth) + UserProfile (password de BGG). Para cualquier campo de contraseña nuevo usá este, NO un `<input type="password">` pelado.

## Mensajes de error de BGG (`utils/bggErrors.js`)

Para los endpoints de BGG de `/perfil` NO mostrar el `message` crudo del server (es escueto: "Credenciales BGG inválidas"). Usar los mappers status-aware:

- `bggConnectErrorMessage(err, { brandName })` — connect: 401 = password incorrecta (la confusión común con la password del sitio; brand-aware por tenant), 502/503/504 = BGG caído (no es tu password), 400 pass-through.
- `bggSyncErrorMessage(err)` — sync/"Reconciliar": 404 = usuario BGG inexistente, 502/503/504 = falló a mitad (tranquiliza: lo ya sincronizado se conserva), 400/429 pass-through.

Distinto del genérico [`getErrorMessage`](feedback_errors_as_toasts.md) (que solo extrae `{message}`): acá el valor es traducir el **status** a copy accionable. Para otros flujos con causas distinguibles por status, seguí el mismo patrón.

## Status chips (radiogroup pattern)

Reemplazo de `<select>` por chips clickeables para enums cortos (≤6 opciones). Patrón aplicado en EventoForm para `status`:

- Wrapper `<div role="radiogroup" aria-label="Estado del evento">`.
- Cada chip: `<button type="button" role="radio" aria-checked={isActive}>`.
- Color por valor (gris draft / verde open / naranja closed / rojo cancelled): siempre visible en el dot; el chip activo se tinta con el color de la categoría.
- En tests: `screen.getByRole('radio', { name: /borrador/i })` + `aria-checked` para asserciones.

## Convenciones de input styles

**Altura uniforme**: TODOS los inputs en forms (incluso `<select>`, `<input type="datetime-local">`, `<PlaceAutocomplete>`, `.btnSearch`) tienen `box-sizing: border-box; height: 42px`. Sin esto las UI nativas (picker icon, dropdown arrow) generan altura intrínseca distinta y rompen la alineación en `.row` flex.

**Border radius unificado**: `10px` para todos los inputs y botones complementarios. Aplica a EventoForm `.input`, `.select`, `.btnSearch` + PlaceAutocomplete `.input`.

**Placeholder color**: usar `color: var(--text-muted); opacity: 1` (Firefox aplica `opacity: 0.54` por default — sin override el placeholder se ve más tenue que el resto).

**Label height uniforme**: `.fieldLabel` con `min-height: 24px` + `display: inline-flex; align-items: center` para que labels con/sin `InfoTooltip` o tag `(opcional)` no rompan la alineación de inputs en una `.row`.

## Convenciones de form patterns

- **Validación**: solo en `handleSubmit` (JS), nunca HTML `required` en inputs — el browser bloquea el submit y no llega a las validaciones con mensajes amigables.
- **Errores transitorios**: `setError("mensaje")` + `setTimeout(() => setError(""), 3000)`.
- **FormData**: campos complejos (objetos) van serializados como JSON string. Server hace `JSON.parse` en `normalizeLocationInput` (ver `server/utils/locationHelpers.js`).
- **Image dropzone label**: usar `<span className={styles.fieldLabel}>` (no `<label htmlFor>`) porque el ImageDropzone tiene su propio file input oculto + handler de click sobre el wrapper.

## Distancia y formato

`client/src/utils/distance.js#formatDistanceKm(km)`:

- Devuelve `null` para `km == null` o cualquier valor que redondea a 0 metros (incluido 0 exacto y distancias minúsculas < 10m). Los componentes lo usan directo sin checks extra: `const label = formatDistanceKm(item.distanceKm)` y `{label && <span>· {label}</span>}`.
- Formato AR: `"850 m"` / `"12,3 km"` / `"250 km"`.

## Relacionado

- [feedback_google_maps_setup.md](feedback_google_maps_setup.md) — Google Maps + Places + Geocoding.
- [feedback_debounce_inputs.md](feedback_debounce_inputs.md) — `useDebouncedValue` para inputs → API.
