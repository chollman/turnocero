# Plan: Convertir Turnocero en PWA instalable

## Contexto

El usuario quiere que la app sea instalable en celulares como PWA. Actualmente el proyecto no tiene ningún elemento PWA: sin manifest, sin service worker, sin iconos en múltiples tamaños, sin meta tags de tema. El objetivo es cumplir todos los requisitos mínimos de instalabilidad.

---

## Estado actual

| Requisito PWA | Estado |
|---|---|
| `manifest.json` | ✗ Falta |
| Service Worker | ✗ Falta |
| Iconos (192 / 512 px) | ✗ Falta |
| `<meta name="theme-color">` | ✗ Falta |
| `<link rel="apple-touch-icon">` | ✗ Falta |
| Viewport meta | ✓ Presente |
| HTTPS / localhost | ✓ Localhost en dev |

---

## Enfoque recomendado: `vite-plugin-pwa` + `@vite-pwa/assets-generator`

`vite-plugin-pwa` es la solución estándar para proyectos Vite. Genera e inyecta el manifest, registra el service worker via Workbox, y puede generar todos los tamaños de íconos a partir del SVG existente (`dice.svg`).

---

## Pasos de implementación

### 1. Instalar dependencias (en `client/`)
```
npm install -D vite-plugin-pwa @vite-pwa/assets-generator
```

### 2. Generar íconos (`client/public/`)

Crear `client/pwa-assets.config.js` apuntando a `dice.svg`:
```js
import { defineConfig } from '@vite-pwa/assets-generator/config'
export default defineConfig({
  preset: 'minimal',
  images: ['public/dice.svg'],
})
```
Luego ejecutar: `npx @vite-pwa/assets-generator`

Esto genera en `client/public/`:
- `pwa-192x192.png`
- `pwa-512x512.png`
- `apple-touch-icon.png` (180x180)
- `favicon.ico`

> Si `dice.svg` no está en `public/`, copiarlo desde donde está.

### 3. Configurar `vite-plugin-pwa` en `client/vite.config.js`

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['dice.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Turnocero',
        short_name: 'Turnocero',
        description: 'Organizá mesas de juego con tu comunidad',
        theme_color: '#1888ef',
        background_color: '#0a0d15',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // No cachear las llamadas a la API ni WebSockets
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: { /* igual que antes */ },
});
```

### 4. Agregar meta tags en `client/index.html`

Agregar dentro de `<head>`:
```html
<meta name="theme-color" content="#1888ef" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Turnocero" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```
El `<link rel="manifest">` lo inyecta automáticamente el plugin.

### 5. (Opcional) Prompt de instalación en UI

Agregar un hook `useInstallPrompt` que capture el evento `beforeinstallprompt` y lo exponga. Mostrar un botón discreto en el Sidebar o en alguna página. Esto mejora la UX pero **no es requisito de instalabilidad** — los navegadores muestran su propio banner si el resto está OK.

---

## Archivos a modificar / crear

| Archivo | Acción |
|---|---|
| `client/vite.config.js` | Agregar `VitePWA(...)` |
| `client/index.html` | Agregar 5 meta/link tags |
| `client/pwa-assets.config.js` | Crear (configuración del generador) |
| `client/public/pwa-192x192.png` | Generado |
| `client/public/pwa-512x512.png` | Generado |
| `client/public/apple-touch-icon.png` | Generado |
| `client/package.json` | 2 nuevas devDependencies |

---

## Verificación

1. `npm run dev:client` → en Chrome DevTools > Application > Manifest: debe aparecer con íconos y sin errores
2. DevTools > Application > Service Worker: debe aparecer registrado
3. En Chrome, el ícono de instalación (⊕) debe aparecer en la barra de dirección
4. En Android (Lighthouse): `npx lighthouse http://localhost:3000 --view` → sección PWA debe pasar todos los checks
5. En iOS Safari: "Agregar a pantalla de inicio" debe funcionar
