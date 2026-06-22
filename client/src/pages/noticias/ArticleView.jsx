import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Avatar from "../../components/shared/Avatar";
import Meeple from "../../components/shared/Meeple";
import RichTextContent from "../../components/shared/RichTextContent";
import { getLocale } from "../../utils/locale";
import { getUserDisplay } from "../../utils/userDisplay";
import {
  categoryLabel,
  categoryColor,
  isLiveCategory,
} from "../../utils/noticiaCategories";
import { readingLabel } from "../../utils/readingTime";
import styles from "./ArticleView.module.css";

function longDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ¿El body es HTML enriquecido o texto plano (noticias viejas)?
function isHtml(body) {
  return /<[a-z][\s\S]*>/i.test(body || "");
}

function ArticleBody({ body }) {
  if (!body) return null;
  if (isHtml(body)) {
    return (
      <RichTextContent extended html={body} className={styles.bodyProse} />
    );
  }
  // Texto plano: un párrafo por bloque separado por líneas en blanco.
  const paras = body.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className={styles.bodyProse}>
      {paras.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

/**
 * Render editorial de un artículo de Noticias. Lo usan el detalle público y la
 * vista previa del editor.
 *
 * Props:
 *   noticia — { title, dek, kicker, category, body, image, quote, tags, author,
 *               publishedAt, createdAt }
 *   author — override del autor (preview usa al usuario actual)
 *   shareSlot — nodo a la derecha del byline (botones de compartir)
 *   adminActions — nodo de acciones admin (editar/eliminar)
 *   onImageClick — abre el lightbox
 *   related — [noticia] para "Seguí leyendo"
 *   preview — modo previsualización (sin links de related)
 */
export default function ArticleView({
  noticia,
  author,
  shareSlot = null,
  adminActions = null,
  onImageClick,
  related = [],
  preview = false,
}) {
  const { t } = useTranslation();
  if (!noticia) return null;
  const cat = noticia.category || "general";
  const kicker = noticia.kicker || categoryLabel(cat);
  const who = getUserDisplay(author || noticia.author);
  const date = noticia.publishedAt || noticia.createdAt;

  return (
    <article className={styles.article}>
      <div className={styles.kicker} style={{ color: categoryColor(cat) }}>
        {isLiveCategory(cat) && (
          <span className={styles.liveDot} aria-hidden="true" />
        )}
        <Meeple /> {categoryLabel(cat)}
        {kicker && kicker !== categoryLabel(cat) ? ` · ${kicker}` : ""}
      </div>

      {noticia.title && <h1 className={styles.headline}>{noticia.title}</h1>}
      {noticia.dek && <p className={styles.dek}>{noticia.dek}</p>}

      <div className={styles.byline}>
        <Avatar user={author || noticia.author} size="md" />
        <div className={styles.bylineInfo}>
          <span className={styles.author}>
            {t("noticias:article.by", { name: who.name })}
          </span>
          <span className={styles.bylineMeta}>
            {longDate(date)}
            {noticia.body ? ` · ${readingLabel(noticia.body)}` : ""}
          </span>
        </div>
        {adminActions}
        {shareSlot}
      </div>

      {noticia.image?.url && (
        <button
          type="button"
          className={styles.hero}
          onClick={onImageClick}
          aria-label={t("noticias:article.viewFullImage")}
          disabled={!onImageClick}
        >
          <img src={noticia.image.url} alt={noticia.title || ""} />
          {noticia.image.caption && (
            <span className={styles.heroCaption}>{noticia.image.caption}</span>
          )}
        </button>
      )}

      <div className={styles.bodyWrap}>
        <ArticleBody body={noticia.body} />

        {noticia.quote?.text && (
          <div className={styles.breakout}>
            <p className={styles.breakoutText}>{noticia.quote.text}</p>
            {(noticia.quote.author || noticia.quote.context) && (
              <div className={styles.breakoutAttrib}>
                —{" "}
                {noticia.quote.author && (
                  <strong>{noticia.quote.author}</strong>
                )}
                {noticia.quote.context ? ` · ${noticia.quote.context}` : ""}
              </div>
            )}
          </div>
        )}

        {noticia.link && (
          <a
            href={noticia.link}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.externalLink}
          >
            {noticia.linkLabel || t("noticias:article.linkFallback")}
          </a>
        )}

        {noticia.tags?.length > 0 && (
          <div className={styles.tags}>
            {noticia.tags.map((t) => (
              <span key={t} className={styles.tag}>
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className={styles.separator} aria-hidden="true">
          <Meeple />
        </div>
      </div>

      {!preview && related.length > 0 && (
        <div className={styles.footer}>
          <div className={styles.relatedHeading}>
            <Meeple /> {t("noticias:article.keepReading")}
          </div>
          <div className={styles.relatedGrid}>
            {related.map((r) => (
              <Link
                key={r._id}
                to={`/noticias/${r._id}`}
                className={styles.relatedCard}
              >
                <span
                  className={styles.relatedKicker}
                  style={{ color: categoryColor(r.category) }}
                >
                  {r.kicker || categoryLabel(r.category)}
                </span>
                <h4 className={styles.relatedTitle}>{r.title}</h4>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
