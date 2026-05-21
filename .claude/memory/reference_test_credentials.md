---
name: reference-test-credentials
description: Test user credentials for logging into the Turnocero preview/dev environment to verify authenticated pages
metadata: 
  node_type: memory
  type: reference
  originSessionId: b4176895-872a-4701-8775-6200559db029
---

Test user for verifying authenticated pages in the preview/dev server:

- Email: `claudiohollman+5@gmail.com`
- Password: `YourStrongPassword1!`

Use these when a change is observable only behind `<PrivateRoute>` (e.g. `/eventos`, `/mesas`, `/torneos`, `/perfil`, `/notificaciones`) and the preview tools need to render the page. Login endpoint: `POST /api/auth/login`.
