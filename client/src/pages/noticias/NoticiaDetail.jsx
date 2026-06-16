import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useBrandName } from "../../hooks/useBrandName";
import { useShortLink } from "../../hooks/useShortLink";
import { getShortUrl } from "../../utils/shortlink";
import { buildNoticiaShare } from "../../utils/share";
import { API } from "../../api/endpoints";
import BackButton from "../../components/shared/BackButton";
import Modal from "../../components/shared/Modal";
import ArticleView from "./ArticleView";
import styles from "./NoticiaDetail.module.css";

const SHARE_URL = (id) =>
  typeof window !== "undefined"
    ? `${window.location.origin}/noticias/${id}`
    : `/noticias/${id}`;

function ogImage(url) {
  if (!url) return null;
  return url.includes("/upload/")
    ? url.replace("/upload/", "/upload/w_1200,h_630,c_fill,g_auto/")
    : url;
}

// Primera imagen del cuerpo — fallback de og:image cuando la nota no tiene
// foto de portada propia pero sí imágenes embebidas.
function firstBodyImage(html) {
  const m = /<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["']/i.exec(html || "");
  return m ? m[1] : null;
}

export default function NoticiaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const brandName = useBrandName();
  const isAdmin = user?.isAdmin;

  const [noticia, setNoticia] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [copied, setCopied] = useState(false);
  const { shortUrl } = useShortLink({ type: "noticia", ref: id, eager: true });

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setNotFound(false);
    axios
      .get(API.noticias.DETAIL(id), { signal: ac.signal })
      .then(({ data }) => {
        if (ac.signal.aborted) return;
        setNoticia(data);
        // "Seguí leyendo": otras noticias, misma categoría primero.
        const params = new URLSearchParams({ limit: "6" });
        if (data.category && data.category !== "general")
          params.set("category", data.category);
        return axios.get(`${API.noticias.LIST}?${params}`, {
          signal: ac.signal,
        });
      })
      .then((res) => {
        if (!res || ac.signal.aborted) return;
        setRelated(
          (res.data.noticias || []).filter((n) => n._id !== id).slice(0, 2),
        );
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [id]);

  const handleCopy = async () => {
    const u =
      (await getShortUrl({
        type: "noticia",
        ref: id,
        origin: window.location.origin,
      })) || SHARE_URL(id);
    navigator.clipboard?.writeText(u);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar esta noticia?")) return;
    try {
      await axios.delete(API.noticias.DELETE(id));
      navigate("/noticias");
    } catch {
      /* el toast global cubre el error */
    }
  };

  if (loading)
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <BackButton to="/noticias">Volver al noticiero</BackButton>
          <div className={styles.skeleton}>
            <div className={styles.skLine} style={{ width: "30%" }} />
            <div className={styles.skTitle} />
            <div className={styles.skLine} style={{ width: "75%" }} />
            <div className={styles.skImg} />
            {[90, 96, 80].map((w, i) => (
              <div
                key={i}
                className={styles.skLine}
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    );

  if (notFound)
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.notFoundTitle}>Noticia no encontrada</p>
          <BackButton to="/noticias">Volver al noticiero</BackButton>
        </div>
      </div>
    );

  if (!noticia) return null;

  const url = SHARE_URL(id);
  const shareUrl = shortUrl || url;
  const { whatsappText, caption } = buildNoticiaShare(
    noticia,
    typeof window !== "undefined" ? window.location.origin : "",
    shortUrl,
  );
  const metaTitle = `${noticia.title || "Noticias"} – ${brandName} 🗞️`;
  const metaDesc =
    noticia.dek ||
    (noticia.body || "").replace(/<[^>]+>/g, " ").slice(0, 200) ||
    "Novedades de la comunidad.";
  const metaImage = ogImage(noticia.image?.url || firstBodyImage(noticia.body));

  const shareSlot = (
    <div className={styles.shareGroup}>
      <a
        className={styles.shareBtn}
        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Compartir en WhatsApp"
        aria-label="Compartir en WhatsApp"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.862L.057 23.886a.5.5 0 0 0 .612.612l6.05-1.48A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.51-5.166-1.396l-.37-.22-3.827.934.952-3.782-.243-.388A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
      </a>
      <a
        className={styles.shareBtn}
        href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(caption)}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Compartir en Telegram"
        aria-label="Compartir en Telegram"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.08 13.63l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.931z" />
        </svg>
      </a>
      <a
        className={styles.shareBtn}
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Compartir en X"
        aria-label="Compartir en X"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
      <button
        className={`${styles.shareBtn} ${copied ? styles.shareBtnCopied : ""}`}
        onClick={handleCopy}
        title={copied ? "¡Copiado!" : "Copiar link"}
        aria-label="Copiar link"
      >
        {copied ? (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        )}
      </button>
    </div>
  );

  const adminActions = isAdmin ? (
    <div className={styles.adminActions}>
      <button
        className={styles.adminBtn}
        onClick={() => navigate(`/noticias/${id}/editar`)}
      >
        Editar
      </button>
      <button
        className={`${styles.adminBtn} ${styles.adminDanger}`}
        onClick={handleDelete}
      >
        Eliminar
      </button>
    </div>
  ) : null;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={url} />
        <meta property="og:locale" content="es_AR" />
        <meta property="og:site_name" content={brandName} />
        {metaImage && <meta property="og:image" content={metaImage} />}
        {metaImage && (
          <meta property="og:image:secure_url" content={metaImage} />
        )}
        {metaImage && <meta property="og:image:width" content="1200" />}
        {metaImage && <meta property="og:image:height" content="630" />}
        <meta
          name="twitter:card"
          content={metaImage ? "summary_large_image" : "summary"}
        />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDesc} />
        {metaImage && <meta name="twitter:image" content={metaImage} />}
      </Helmet>

      <div className={styles.inner}>
        <BackButton to="/noticias">Volver al noticiero</BackButton>

        {noticia.status === "draft" && (
          <div className={styles.draftBanner}>
            Esta noticia es un <strong>borrador</strong> — solo vos la ves.
          </div>
        )}

        <ArticleView
          noticia={noticia}
          shareSlot={shareSlot}
          adminActions={adminActions}
          onImageClick={() => setLightbox(true)}
          related={related}
        />
      </div>

      {lightbox && (
        <Modal
          isOpen={lightbox}
          onClose={() => setLightbox(false)}
          ariaLabel="Imagen de la noticia"
          className={styles.lightbox}
          backdropClassName={styles.lightboxBackdrop}
        >
          <img
            src={noticia.image.url}
            alt={noticia.title || ""}
            className={styles.lightboxImg}
            onClick={() => setLightbox(false)}
          />
        </Modal>
      )}
    </div>
  );
}
