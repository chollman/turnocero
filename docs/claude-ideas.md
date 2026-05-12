# Ideas y tareas para Claude Code

Cosas concretas que se le pueden pedir a Claude Code para seguir desarrollando Turnocero.

---

## Features nuevas

- **Sistema de valoración completo** — el modelo `Rating` existe pero no está conectado a la UI. Implementar vista de ratings por usuario/mesa.
- **Mapa con ubicaciones de mesas** — el modelo `User` ya tiene `direccion.lat/lng`. Mostrar mesas en un mapa usando Leaflet o similar.
- **Filtros combinados en el Dashboard** — búsqueda por fecha, juego, y cantidad de lugares disponibles al mismo tiempo.
- **Página pública de una mesa** — que se pueda compartir un link sin estar logueado.

---

## Calidad de código

- `/react-review` — revisar todos los archivos React del proyecto de una vez buscando problemas de best practices.
- `/security-review` — auditoría de seguridad de los cambios recientes (JWT handling, validaciones, permisos de rutas).
- **Refactor de TableDetail** — el archivo más grande del proyecto mezcla chat, comentarios, imágenes, join requests y reacciones. Dividir en sub-componentes.
- **Error boundaries** en React para atrapar crashes sin romper toda la app.

---

## Infraestructura / DevOps

- **Dockerfile** para levantar el proyecto completo (cliente + servidor + mongo) en un solo comando.
- **Guía de deploy a producción** — variables de entorno y pasos para Railway, Render, o Fly.io.
- **Rate limiting en la API** — el proyecto tiene express-validator pero no throttling. Agregar `express-rate-limit` en rutas sensibles (auth, join).

---

## Testing

- **Setup de Vitest** para el cliente y Jest para el servidor — el proyecto no tiene tests configurados.
- **Tests de integración** para las rutas críticas: join/leave, aceptar/rechazar join request, cancelar mesa.

---

## Documentación

- `/init` — regenerar el `CLAUDE.md` para reflejar todo lo que creció el proyecto (ratings, imágenes, notificaciones, privacidad, Socket.IO, etc.).
- **Guía de onboarding** para colaboradores nuevos.
