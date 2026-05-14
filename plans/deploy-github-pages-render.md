# Plan: Deploy Turnocero to GitHub Pages + Render via GitHub Actions

## Context

The app has three separate pieces that each need their own home:
- **Database** → MongoDB Atlas (free cloud DB)
- **Backend API** → Render (free cloud server)
- **Frontend** → GitHub Pages (free static hosting)

GitHub Pages only serves static HTML/CSS/JS files — it cannot run Node.js/Express. So the backend must be deployed separately, and the React frontend must be configured to call that backend's URL instead of a local proxy.

GitHub Actions will automatically build and deploy the frontend to GitHub Pages every time you push to `master`.

**Final URLs:**
- Frontend: `https://chollman.github.io/table-creator/`
- Backend: `https://[your-app-name].onrender.com` (assigned by Render)

---

## Phase 1 — Set up MongoDB Atlas (cloud database)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and create a free account.
2. Click **"Build a Database"** → choose **M0 Free** → pick any region → click **Create**.
3. On the **"Security Quickstart"** screen:
   - Create a database user (username + password — write these down).
   - Under **"Where would you like to connect from?"** → choose **"My Local Environment"** → add IP `0.0.0.0/0` (allows any IP — needed for Render's dynamic IPs).
4. Click **"Go to Database"** → click **"Connect"** → **"Drivers"** → copy the connection string. It looks like:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with your actual password. Save this string — it goes in Render next.

---

## Phase 2 — Deploy backend to Render

1. Go to [render.com](https://render.com) and sign up (use "GitHub" login for convenience).
2. Click **"New +"** → **"Web Service"**.
3. Connect your GitHub account and select the `table-creator` repo.
4. Fill in the form:
   - **Name:** `turnocero-api` (or anything)
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
5. Click **"Advanced"** → add these environment variables:
   | Key | Value |
   |-----|-------|
   | `MONGODB_URI` | the Atlas connection string from Phase 1 |
   | `JWT_SECRET` | any long random string (e.g. `turnocero_super_secret_2024`) |
   | `PORT` | `4000` |
6. Click **"Create Web Service"**. Render will build and deploy — takes ~2 minutes.
7. Once deployed, copy the service URL (e.g. `https://turnocero-api.onrender.com`). This is your `VITE_API_URL`.

> **Note:** Free Render services sleep after 15 minutes of inactivity. The first request after sleeping takes ~30 seconds. This is acceptable for a personal project.

---

## Phase 3 — Code changes (4 edits)

### 3a. `client/vite.config.js` — set the base path for GitHub Pages

Add `base: '/table-creator/'` so Vite generates correct asset paths for the subdirectory URL.

```js
// client/vite.config.js
export default defineConfig({
  base: '/table-creator/',   // ← add this line
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

### 3b. `client/src/App.jsx` — switch to HashRouter

GitHub Pages serves static files and can't redirect `404` requests to `index.html`. Switching to `HashRouter` means URLs use a `#` fragment (`/#/login`, `/#/create`) which GitHub Pages never touches — React Router handles it entirely in the browser.

Change one import and one component name in [client/src/App.jsx](client/src/App.jsx:1):
- Line 1: `BrowserRouter` → `HashRouter`
- Line 56: `<BrowserRouter>` → `<HashRouter>`
- Line 61: `</BrowserRouter>` → `</HashRouter>`

### 3c. `client/src/main.jsx` — configure axios base URL

Add two lines at the top of [client/src/main.jsx](client/src/main.jsx):

```jsx
import axios from 'axios';
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';
```

This means:
- In **local dev** (`VITE_API_URL` not set): axios uses relative paths like `/api/...`, which the Vite dev proxy forwards to `localhost:4000`. Nothing changes.
- In **production** on GitHub Pages: axios prepends the Render URL to every request.

### 3d. `.github/workflows/deploy.yml` — NEW file (GitHub Actions)

Create this file at `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: client/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: client

      - name: Build
        run: npm run build
        working-directory: client
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

      - name: Setup GitHub Pages
        uses: actions/configure-pages@v4

      - name: Upload build artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: client/dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## Phase 4 — GitHub repository setup

### 4a. Add the secret

1. Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Name: `VITE_API_URL`
3. Value: the Render URL from Phase 2 (e.g. `https://turnocero-api.onrender.com`)
4. Click **Add secret**.

### 4b. Enable GitHub Pages

1. Go to **Settings** → **Pages**.
2. Under **"Source"**, select **GitHub Actions**.
3. Click **Save**.

---

## Phase 5 — Deploy and verify

1. Push all code changes to `master`.
2. Go to **Actions** tab on GitHub — you'll see a workflow run named "Deploy to GitHub Pages".
3. Wait for it to complete (about 1-2 minutes).
4. Visit `https://chollman.github.io/table-creator/` — the app should load.
5. Test: register a new user, create a table, join/leave.

---

## Critical files to modify

| File | Change |
|------|--------|
| [client/vite.config.js](client/vite.config.js) | Add `base: '/table-creator/'` |
| [client/src/App.jsx](client/src/App.jsx) | `BrowserRouter` → `HashRouter` (3 spots) |
| [client/src/main.jsx](client/src/main.jsx) | Add axios baseURL from env var |
| `.github/workflows/deploy.yml` | Create new file |

---

## Verification checklist

- [ ] MongoDB Atlas cluster created and IP whitelisted
- [ ] Render service shows "Live" status and `/api/health` returns `{"status":"ok"}`
- [ ] `VITE_API_URL` secret added to GitHub repo
- [ ] GitHub Pages source set to "GitHub Actions"
- [ ] First GitHub Actions workflow run passes (green checkmark)
- [ ] App loads at `https://chollman.github.io/table-creator/`
- [ ] Can register, log in, create and join tables
