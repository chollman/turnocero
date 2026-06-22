import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import { API } from "../../api/endpoints";
import BackButton from "../../components/shared/BackButton";
import RichTextEditor from "../../components/shared/RichTextEditor";
import CommunitySelect from "../../components/shared/CommunitySelect";
import Meeple from "../../components/shared/Meeple";
import { getNoticiaCategories } from "../../utils/noticiaCategories";
import ArticleView from "./ArticleView";
import styles from "./NoticiaForm.module.css";

function CoverDropzone({ preview, onFile, onRemove }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className={styles.coverField}>
      <span className={styles.label}>Portada</span>
      <div
        className={`${styles.dropzone} ${preview ? styles.hasPreview : ""} ${
          dragOver ? styles.dragOver : ""
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        {preview ? (
          <img src={preview} alt="Portada" className={styles.coverPreview} />
        ) : (
          <div className={styles.dropHint}>
            <span className={styles.dropIcon}>🖼️</span>
            Arrastrá una imagen o hacé clic para subir la portada
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onFile(f);
          }}
        />
      </div>
      {preview && (
        <button type="button" className={styles.removeCover} onClick={onRemove}>
          Quitar portada
        </button>
      )}
    </div>
  );
}

function TagsInput({ tags, setTags }) {
  const [draft, setDraft] = useState("");

  const add = (raw) => {
    const t = raw.trim().toLowerCase().slice(0, 32);
    if (!t) return;
    setTags((prev) =>
      prev.includes(t) || prev.length >= 6 ? prev : [...prev, t],
    );
    setDraft("");
  };

  return (
    <div className={styles.field}>
      <span className={styles.label}>Etiquetas (máx 6)</span>
      <div className={styles.tagsBox}>
        {tags.map((t) => (
          <span key={t} className={styles.tagChip}>
            #{t}
            <button
              type="button"
              aria-label={`Quitar ${t}`}
              onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
            >
              ✕
            </button>
          </span>
        ))}
        {tags.length < 6 && (
          <input
            className={styles.tagInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && !draft && tags.length) {
                setTags((prev) => prev.slice(0, -1));
              }
            }}
            onBlur={() => draft && add(draft)}
            placeholder={tags.length ? "Otra…" : "torneo, reseña, novedad…"}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Form compartido de creación/edición de noticias (WordPress-style).
 * Props: mode ("create" | "edit"), initial (noticia para editar), id.
 */
export default function NoticiaForm({ mode = "create", initial = null, id }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const brandName = useBrandName();
  const isEdit = mode === "edit";

  const [title, setTitle] = useState(initial?.title || "");
  const [dek, setDek] = useState(initial?.dek || "");
  const [kicker, setKicker] = useState(initial?.kicker || "");
  const [category, setCategory] = useState(initial?.category || "general");
  const [tags, setTags] = useState(initial?.tags || []);
  const [body, setBody] = useState(initial?.body || "");
  const [link, setLink] = useState(initial?.link || "");
  const [linkLabel, setLinkLabel] = useState(initial?.linkLabel || "");
  const [quoteText, setQuoteText] = useState(initial?.quote?.text || "");
  const [quoteAuthor, setQuoteAuthor] = useState(initial?.quote?.author || "");
  const [quoteContext, setQuoteContext] = useState(
    initial?.quote?.context || "",
  );
  const [featured, setFeatured] = useState(!!initial?.featured);
  const [isBrief, setIsBrief] = useState(!!initial?.isBrief);
  const [imageCaption, setImageCaption] = useState(
    initial?.image?.caption || "",
  );
  const [community, setCommunity] = useState("");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(initial?.image?.url || null);
  const [removeImage, setRemoveImage] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFile = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setRemoveImage(false);
  };
  const handleRemoveCover = () => {
    setFile(null);
    setPreview(null);
    setRemoveImage(true);
  };

  const previewNoticia = {
    title,
    dek,
    kicker,
    category,
    tags,
    body,
    link,
    linkLabel,
    image: preview ? { url: preview, caption: imageCaption } : undefined,
    quote: quoteText
      ? { text: quoteText, author: quoteAuthor, context: quoteContext }
      : undefined,
    publishedAt: initial?.publishedAt || new Date().toISOString(),
  };

  const submit = async (status) => {
    if (!title.trim() && !body.trim() && !preview) {
      addToast({
        type: "error",
        title: "Faltan datos",
        message: "Cargá al menos un título, cuerpo o portada.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("dek", dek.trim());
      fd.append("kicker", kicker.trim());
      fd.append("category", category);
      fd.append("tags", JSON.stringify(tags));
      fd.append("body", body);
      fd.append("link", link.trim());
      fd.append("linkLabel", linkLabel.trim());
      fd.append(
        "quote",
        quoteText.trim()
          ? JSON.stringify({
              text: quoteText.trim(),
              author: quoteAuthor.trim(),
              context: quoteContext.trim(),
            })
          : "",
      );
      fd.append("featured", String(featured));
      fd.append("isBrief", String(isBrief));
      fd.append("status", status);
      fd.append("imageCaption", imageCaption.trim());
      if (file) fd.append("image", file);
      if (isEdit && removeImage) fd.append("removeImage", "true");
      if (!isEdit && community) fd.append("community", community);

      const { data } = isEdit
        ? await axios.put(API.noticias.UPDATE(id), fd, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        : await axios.post(API.noticias.CREATE, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });

      addToast({
        type: "success",
        title: status === "draft" ? "Borrador guardado" : "Noticia publicada",
        message:
          status === "draft"
            ? "Solo vos la ves hasta que la publiques."
            : "Ya está en el noticiero.",
      });
      navigate(`/noticias/${data._id}`);
    } catch (err) {
      addToast({
        type: "error",
        title: "No se pudo guardar",
        message: err.response?.data?.message || "Intentá de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{`${isEdit ? "Editar" : "Nueva"} noticia – ${brandName}`}</title>
      </Helmet>
      <div className={styles.inner}>
        <BackButton to={isEdit ? `/noticias/${id}` : "/noticias"} flush>
          {isEdit ? "Volver a la noticia" : "Volver al noticiero"}
        </BackButton>
        <header className={styles.hero}>
          <div className={styles.eyebrow}>
            <Meeple /> REDACCIÓN
          </div>
          <h1 className={styles.title}>
            {isEdit ? "Editar noticia" : "Nueva noticia"}
          </h1>
          <p className={styles.sub}>
            Cargá la nota como en un diario: portada, titular, bajada y cuerpo
            enriquecido. Guardá borrador y previsualizá antes de publicar.
          </p>
        </header>

        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${!showPreview ? styles.toggleActive : ""}`}
            onClick={() => setShowPreview(false)}
          >
            Editar
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${showPreview ? styles.toggleActive : ""}`}
            onClick={() => setShowPreview(true)}
          >
            Vista previa
          </button>
        </div>

        {showPreview ? (
          <div className={styles.previewBox}>
            <ArticleView noticia={previewNoticia} author={user} preview />
          </div>
        ) : (
          <form
            className={styles.formCard}
            onSubmit={(e) => {
              e.preventDefault();
              submit("published");
            }}
          >
            <CoverDropzone
              preview={preview}
              onFile={handleFile}
              onRemove={handleRemoveCover}
            />
            {preview && (
              <label className={styles.field}>
                <span className={styles.label}>Epígrafe de la portada</span>
                <input
                  className={styles.input}
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  maxLength={200}
                  placeholder="Dónde / cuándo fue la foto"
                />
              </label>
            )}

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>Categoría</span>
                <select
                  className={styles.input}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {Object.entries(getNoticiaCategories()).map(
                    ([key, { label }]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Kicker (opcional)</span>
                <input
                  className={styles.input}
                  value={kicker}
                  onChange={(e) => setKicker(e.target.value)}
                  maxLength={60}
                  placeholder="Etiqueta corta sobre el título"
                />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Titular</span>
              <input
                className={`${styles.input} ${styles.titleInput}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="El titular de la nota"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Bajada</span>
              <textarea
                className={styles.textarea}
                value={dek}
                onChange={(e) => setDek(e.target.value)}
                rows={2}
                maxLength={320}
                placeholder="Resumen de una o dos líneas (también es la descripción al compartir)."
              />
            </label>

            <TagsInput tags={tags} setTags={setTags} />

            <div className={styles.field}>
              <span className={styles.label}>Cuerpo</span>
              <RichTextEditor
                value={body}
                onChange={setBody}
                extended
                uploadUrl={API.noticias.INLINE_IMAGE}
                placeholder="Escribí la nota. Podés agregar subtítulos, imágenes, videos de YouTube…"
                maxLength={40000}
              />
            </div>

            <details className={styles.extra}>
              <summary>Cita destacada (opcional)</summary>
              <label className={styles.field}>
                <span className={styles.label}>Texto de la cita</span>
                <textarea
                  className={styles.textarea}
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  rows={2}
                  maxLength={400}
                  placeholder="«Una frase memorable…»"
                />
              </label>
              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>Autor de la cita</span>
                  <input
                    className={styles.input}
                    value={quoteAuthor}
                    onChange={(e) => setQuoteAuthor(e.target.value)}
                    maxLength={80}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Contexto</span>
                  <input
                    className={styles.input}
                    value={quoteContext}
                    onChange={(e) => setQuoteContext(e.target.value)}
                    maxLength={80}
                    placeholder="rol / lugar"
                  />
                </label>
              </div>
            </details>

            <details className={styles.extra}>
              <summary>Enlace externo (opcional)</summary>
              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>URL</span>
                  <input
                    className={styles.input}
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    maxLength={500}
                    placeholder="https://…"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Texto del botón</span>
                  <input
                    className={styles.input}
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    maxLength={80}
                    placeholder="Ver más →"
                  />
                </label>
              </div>
            </details>

            <div className={styles.flags}>
              <label className={styles.flag}>
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                />
                <span>
                  <strong>Destacada</strong> — va como nota principal de la
                  portada.
                </span>
              </label>
              <label className={styles.flag}>
                <input
                  type="checkbox"
                  checked={isBrief}
                  onChange={(e) => setIsBrief(e.target.checked)}
                />
                <span>
                  <strong>Breve</strong> — va en la columna de "Breves".
                </span>
              </label>
            </div>

            {!isEdit && (
              <CommunitySelect value={community} onChange={setCommunity} />
            )}

            <div className={styles.actions}>
              <Link
                to={isEdit ? `/noticias/${id}` : "/noticias"}
                className={styles.btnGhost}
              >
                Cancelar
              </Link>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={submitting}
                onClick={() => submit("draft")}
              >
                Guardar borrador
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={submitting}
              >
                {submitting ? "Guardando…" : "Publicar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
