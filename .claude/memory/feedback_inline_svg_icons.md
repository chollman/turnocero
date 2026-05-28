---
name: inline-svg-icons
description: "El cliente NO tiene `lucide-react` ni ninguna lib de iconos instalada — usar SVGs inline siguiendo el patrón del Sidebar"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9a3be033-d6c0-4c8c-91d0-814fa0197f78
---

El cliente de Turnocero NO tiene `lucide-react`, `react-icons`, `@heroicons/react` ni ninguna librería de iconos en su `package.json` (verificado 2026-05-28). Importar iconos de esas libs explota Vite con "Failed to resolve import" y rompe los tests también.

**Why:** El proyecto cultiva imports minimalistas y los iconos existentes son todos SVGs inline o emojis. Agregar una dep nueva para 3 iconos infla el bundle y rompe la convención.

**How to apply:** Para cualquier icono nuevo, definir un componente local con `<svg>` inline al tope del archivo (o agrupados en un objeto `ICONS` como `Sidebar.jsx`). Para iconos casuales (logos de sección, emojis decorativos como 💛 📧 ◆ 🎲) usar emojis Unicode directamente.

Ejemplo del patrón ya validado en `ColaborarFab.jsx` / `Colaborar.jsx`:

```jsx
const HeartIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.83A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z" />
  </svg>
);
```

Para outlined icons usar `fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"` (mismo estilo que [Sidebar.jsx](client/src/components/layout/Sidebar.jsx) `ICONS`).
