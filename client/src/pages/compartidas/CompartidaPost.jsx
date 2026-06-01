import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import axios from "axios";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import CompartidaCard from "./CompartidaCard";
import ResenaCard from "./ResenaCard";
import CompartidasSidebar from "./CompartidasSidebar";
import CompartidaSkeleton from "./CompartidaSkeleton";
import styles from "./CompartidaPost.module.css";

// Texto plano a partir del body HTML de una reseña (para meta/description).
const stripHtml = (html) =>
  (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default function CompartidaPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setActiveCompartida } = useNotifications();
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveCompartida(id);
  }, [id, setActiveCompartida]);

  useEffect(() => {
    const ac = new AbortController();
    axios
      .get(API.compartidas.DETAIL(id), { signal: ac.signal })
      .then(({ data }) => {
        if (!ac.signal.aborted) setPost(data);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (err.response?.status === 404)
          setError("Esta compartida no existe o fue eliminada.");
        else if (err.response?.status === 403)
          setError("No tenés acceso a esta compartida.");
        else setError("Error al cargar la compartida.");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [id]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const postUrl = `${origin}/compartidas/${id}`;
  const authorName = post?.author
    ? post.author.displayName || post.author.username
    : "TurnoCero";
  const isResena = post?.category === "resena";
  const metaTitle = post?.title
    ? `${post.title} – TurnoCero 🎲`
    : isResena
      ? `Reseña de ${post?.boardGame?.name || "un juego"} – TurnoCero 🎲`
      : `Compartida de ${authorName} – TurnoCero 🎲`;
  // Para reseñas el body es HTML → texto plano; sumamos juego + puntuación.
  const bodyText = isResena ? stripHtml(post?.body) : post?.body || "";
  const resenaPrefix =
    isResena && post?.boardGame?.name
      ? `Reseña de ${post.boardGame.name}${post.rating != null ? ` · ${post.rating}/10` : ""}. `
      : "";
  const fullDesc = `${resenaPrefix}${bodyText}`.trim();
  const metaDesc = fullDesc
    ? fullDesc.slice(0, 160) + (fullDesc.length > 160 ? "…" : "")
    : "Mirá esta compartida en TurnoCero, la comunidad de juegos de mesa.";
  const rawImage = post?.images?.[0]?.url || post?.boardGame?.image;
  // Resize to 1200×630 via Cloudinary transformation for optimal OG display.
  // Sin foto cae al og-default.png (también 1200×630), así que siempre hay una
  // imagen grande válida para la preview.
  const metaImage = rawImage
    ? rawImage.replace("/upload/", "/upload/w_1200,h_630,c_fill,g_auto/")
    : `${origin}/og-default.png`;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={postUrl} />
        <meta property="og:locale" content="es_AR" />
        <meta property="og:site_name" content="TurnoCero" />
        <meta property="og:image" content={metaImage} />
        <meta property="og:image:secure_url" content={metaImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={metaTitle} />

        {/* Twitter / X */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDesc} />
        <meta name="twitter:image" content={metaImage} />
        <meta name="twitter:image:alt" content={metaTitle} />
      </Helmet>

      <div className={styles.layout}>
        <div className={styles.feedCol}>
          <button
            className={styles.backBtn}
            onClick={() => navigate("/compartidas")}
          >
            ← Volver al feed
          </button>

          {loading && <CompartidaSkeleton />}

          {error && (
            <div className={styles.errorBox}>
              <p>{error}</p>
              <button
                className={styles.backLink}
                onClick={() => navigate("/compartidas")}
              >
                Ir al feed de Compartidas
              </button>
            </div>
          )}

          {post &&
            (isResena ? (
              <ResenaCard
                post={post}
                onDeleted={() => navigate("/compartidas")}
                onUpdated={(updated) => setPost(updated)}
                clampBody={false}
              />
            ) : (
              <CompartidaCard
                post={post}
                onDeleted={() => navigate("/compartidas")}
                onUpdated={(updated) => setPost(updated)}
              />
            ))}
        </div>
        <CompartidasSidebar />
      </div>
    </div>
  );
}
