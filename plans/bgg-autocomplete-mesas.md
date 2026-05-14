# Plan: BGG Game Search Autocomplete en CreateTable

## Context

El formulario de creación de mesas usa un input de texto libre para el nombre del juego (`boardGame`). El usuario quiere reemplazarlo con un autocompletado que busca en la base de datos de BoardGameGeek al escribir (desde el 3er carácter), forzando la selección desde el catálogo. Además se quiere guardar metadata de BGG (ID, thumbnail, año) junto con la mesa.

El servidor ya tiene un proxy BGG funcional en `/api/bgg/` que resuelve el problema de CORS (las llamadas las hace el servidor, no el browser). Solo faltan los endpoints de búsqueda/detalle de juego.

---

## Archivos críticos

- `server/routes/bgg.js` — agregar endpoints de búsqueda y detalle
- `server/models/Table.js` — agregar campos `bggId`, `bggThumbnail`, `bggYear`
- `server/routes/tables.js` — aceptar los nuevos campos en POST/PUT
- `client/src/pages/tables/CreateTable.jsx` — reemplazar input por autocomplete
- `client/src/pages/tables/CreateTable.module.css` — estilos del dropdown

---

## Implementación

### 1. Server — nuevos endpoints BGG (`server/routes/bgg.js`)

Agregar dos endpoints al archivo existente (reutilizando el patrón de caché ya implementado):

**`GET /api/bgg/search?q=<query>`**
- Llama a `https://boardgamegeek.com/xmlapi2/search?query=<q>&type=boardgame&exact=0`
- Parsea XML con `fast-xml-parser` (ya importado)
- Retorna los primeros 15 resultados: `[{ id, name, year }]`
- Caché de 5 minutos por query string

**`GET /api/bgg/game/:id`**
- Llama a `https://boardgamegeek.com/xmlapi2/thing?id=<id>&type=boardgame`
- Parsea XML y retorna: `{ id, name, thumbnail, year, minPlayers, maxPlayers }`
- Caché de 30 minutos por ID

### 2. Server — modelo Table (`server/models/Table.js`)

Agregar campos opcionales (retrocompatibles, los registros existentes quedan intactos):

```js
boardGame: { type: String, required: true, maxlength: 100 },  // ya existe
bggId:        { type: Number, default: null },
bggThumbnail: { type: String, default: null },
bggYear:      { type: Number, default: null },
```

### 3. Server — ruta POST /api/tables (`server/routes/tables.js`)

En el handler de creación (línea ~155), desestructurar y persistir los nuevos campos:

```js
const { boardGame, date, maxPlayers, location, description, privacy, bggId, bggThumbnail, bggYear } = req.body;
// ...
await Table.create({ boardGame, date, maxPlayers, location, description, privacy, host, bggId, bggThumbnail, bggYear });
```

Hacer lo mismo en el handler PUT para edición.

### 4. Client — CreateTable.jsx

**Estado nuevo:**
```js
const [boardGameInput, setBoardGameInput] = useState('');
const [boardGameSelected, setBoardGameSelected] = useState(null); // { name, id, thumbnail, year }
const [suggestions, setSuggestions] = useState([]);
const [searching, setSearching] = useState(false);
const [showDropdown, setShowDropdown] = useState(false);
```

**Lógica de búsqueda:**
- `useEffect` sobre `boardGameInput`: si `length >= 3`, debounce 400ms y llama `GET /api/bgg/search?q=<input>`
- Si el usuario escribe algo distinto a lo seleccionado, limpiar `boardGameSelected`

**Flujo de selección:**
1. Usuario escribe ≥ 3 chars → dropdown con resultados (nombre + año)
2. Selecciona un juego → llama `GET /api/bgg/game/:id` para obtener thumbnail → guarda en `boardGameSelected`
3. El input muestra el nombre seleccionado; el dropdown se cierra
4. Si borra texto, `boardGameSelected` se limpia y el dropdown vuelve a abrirse al seguir escribiendo

**Validación en submit:**
```js
if (!boardGameSelected) {
  setErrors({ boardGame: 'Seleccioná un juego del catálogo de BGG' });
  return;
}
// En el body:
boardGame: boardGameSelected.name,
bggId: boardGameSelected.id,
bggThumbnail: boardGameSelected.thumbnail,
bggYear: boardGameSelected.year,
```

**Eliminar:** los botones de quick-select (chips de juegos populares) y su estado asociado.

### 5. Client — CreateTable.module.css

Agregar estilos para:
- `.gameSearchWrapper` — `position: relative` para contener el dropdown absoluto
- `.suggestions` — dropdown con `position: absolute`, fondo oscuro, `z-index`, max-height + scroll
- `.suggestionItem` — hover highlight, cursor pointer, muestra nombre + año
- `.searching` — estado de carga (spinner o texto "Buscando…")
- `.noResults` — mensaje "Sin resultados en BGG"

---

## Verificación

1. Iniciar servidores: `npm run dev:server` y `npm run dev:client`
2. Ir a `/mesas/crear` (o la ruta de creación de mesas)
3. Escribir ≥ 3 caracteres en el campo de juego → debe aparecer dropdown con resultados de BGG
4. Seleccionar un juego → dropdown se cierra, campo muestra el nombre
5. Intentar enviar sin seleccionar → debe mostrar error de validación
6. Crear mesa correctamente → verificar en MongoDB que `bggId` y `bggThumbnail` se guardaron
7. Verificar que las mesas existentes (sin bggId) siguen funcionando normalmente
