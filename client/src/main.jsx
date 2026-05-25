import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import "./index.css";

axios.defaults.baseURL = import.meta.env.VITE_API_URL || "";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
);
