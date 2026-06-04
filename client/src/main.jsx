import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { detectTenant } from "./utils/tenant";
import "./index.css";

axios.defaults.baseURL = import.meta.env.VITE_API_URL || "";

// Subdominio de comunidad (single-tenant): si entramos por `<slug>.turnocero.com`
// eslint-disable-next-line no-warning-comments
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
