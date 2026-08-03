import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import { useCompartidaQuery, compartidaKeys } from "../../queries/compartidas";
import CompartidaCard from "./CompartidaCard";
import ResenaCard from "./ResenaCard";
import CompartidasSidebar from "./CompartidasSidebar";
import CompartidaSkeleton from "./CompartidaSkeleton";
import BackButton from "../../components/shared/BackButton";
import GuestJoinBanner from "../../components/shared/GuestJoinBanner";
import styles from "./CompartidaPost.module.css";

// Texto plano a partir del body HTML de una reseña (para meta/description).
const stripHtml = (html) =>
  (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default function CompartidaPost() {
  const { t } = useTranslation("compartidas");
  const { id } = useParams();
  const navigate = useNavigate();
  const { setActiveCompartida } = useNotifications();
  const brandName = useBrandName();
  const queryClient = useQueryClient();
  const { data: post, isPending: loading, error: queryError } =
    useCompartidaQuery(id);
  const status = queryError?.response?.status;
  const error = queryError
    ? status === 404
      ? t("post.errorNotFound")
      : status === 403
        ? t("post.errorForbidden")
        : t("post.errorGeneric")
    : "";

  useEffect(() => {
    setActiveCompartida(id);
  }, [id, setActiveCompartida]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const postUrl = `${origin}/compartidas/${id}`;
  const authorName = post?.author
    ? post.author.displayName || post.author.username
    : "TurnoCero";
  const isResena = post?.category === "resena";
  const metaTitle = post?.title
    ? t("post.metaTitleWithTitle", { title: post.title, brand: brandName })
    : isResena
      ? t("post.metaTitleResena", {
          game: post?.boardGame?.name || t("post.metaGameFallback"),
          brand: brandName,
        })
      : t("post.metaTitleDefault", { author: authorName, brand: brandName });
  // Para reseñas el body es HTML → texto plano; sumamos juego + puntuación.
  const bodyText = isResena ? stripHtml(post?.body) : post?.body || "";
  const resenaPrefix =
    isResena && post?.boardGame?.name
      ? t("post.metaResenaPrefix", {
          game: post.boardGame.name,
          rating: post.rating != null ? ` · ${post.rating}/10` : "",
        })
      : "";
  const fullDesc = `${resenaPrefix}${bodyText}`.trim();
  const metaDesc = fullDesc
    ? fullDesc.slice(0, 160) + (fullDesc.length > 160 ? "…" : "")
    : t("post.metaDescDefault");
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
          <BackButton to="/compartidas" flush>
            {t("post.back")}
          </BackButton>

          {/* Aterrizaje viral: el link llegó por WhatsApp/Telegram a un anónimo.
              Le damos contexto + CTA de registro (se auto-oculta logueado). */}
          <GuestJoinBanner />

          {loading && <CompartidaSkeleton />}

          {error && (
            <div className={styles.errorBox}>
              <p>{error}</p>
              <button
                className={styles.backLink}
                onClick={() => navigate("/compartidas")}
              >
                {t("post.goToFeed")}
              </button>
            </div>
          )}

          {post &&
            (isResena ? (
              <ResenaCard
                post={post}
                onDeleted={() => navigate("/compartidas")}
                onUpdated={(updated) =>
                  queryClient.setQueryData(compartidaKeys.detail(id), updated)
                }
                clampBody={false}
              />
            ) : (
              <CompartidaCard
                post={post}
                onDeleted={() => navigate("/compartidas")}
                onUpdated={(updated) =>
                  queryClient.setQueryData(compartidaKeys.detail(id), updated)
                }
              />
            ))}
        </div>
        <CompartidasSidebar />
      </div>
    </div>
  );
}
