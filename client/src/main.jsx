import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { detectTenant } from "./utils/tenant";
import { STORAGE_KEYS } from "./utils/storageKeys";
import { normalizeLang } from "./i18n/config";
import "./index.css";

axios.defaults.baseURL = import.meta.env.VITE_API_URL || "";

// Idioma persistido → header Accept-Language por defecto, seteado al boot (antes
// de cualquier request) para que el primer GET /api/auth/me ya viaje localizado.
// LanguageContext lo actualiza al togglear.
let storedLang = "es";
try {
  storedLang = normalizeLang(localStorage.getItem(STORAGE_KEYS.LANGUAGE));
} catch {
  /* ignore: localStorage no disponible */
}
axios.defaults.headers.common["Accept-Language"] = storedLang;

// Subdominio de comunidad (single-tenant): si entramos por `<slug>.turnocero.com`
// mandamos el slug en cada request para que el server acote todo a esa comunidad.
const tenant = detectTenant();
if (tenant) axios.defaults.headers.common["X-Community-Slug"] = tenant.slug;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
);
