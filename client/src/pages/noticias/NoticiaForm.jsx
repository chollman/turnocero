import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation, Trans } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import { API } from "../../api/endpoints";
import {
  useCreateNoticiaMutation,
  useUpdateNoticiaMutation,
} from "../../queries/noticias";
import BackButton from "../../components/shared/BackButton";
import RichTextEditor from "../../components/shared/RichTextEditor";
import CommunitySelect from "../../components/shared/CommunitySelect";
import Meeple from "../../components/shared/Meeple";
import { getNoticiaCategories } from "../../utils/noticiaCategories";
import ArticleView from "./ArticleView";
import styles from "./NoticiaForm.module.css";

function CoverDropzone({ preview, onFile, onRemove }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className={styles.coverField}>
      <span className={styles.label}>{t("noticias:form.coverLabel")}</span>
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
          <img
            src={preview}
            alt={t("noticias:form.coverAlt")}
            className={styles.coverPreview}
          />
        ) : (
          <div className={styles.dropHint}>
            <span className={styles.dropIcon}>🖼️</span>
            {t("noticias:form.coverHint")}
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
          {t("noticias:form.removeCover")}
        </button>
      )}
    </div>
  );
}

function TagsInput({ tags, setTags }) {
  const { t } = useTranslation();
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
      <span className={styles.label}>{t("noticias:form.tagsLabel")}</span>
      <div className={styles.tagsBox}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tagChip}>
            #{tag}
            <button
              type="button"
              aria-label={t("noticias:form.removeTag", { tag })}
              onClick={() => setTags((prev) => prev.filter((x) => x !== tag))}
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
            placeholder={
              tags.length
                ? t("noticias:form.tagPlaceholderMore")
                : t("noticias:form.tagPlaceholder")
            }
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
  const { t } = useTranslation();
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

  const createNoticia = useCreateNoticiaMutation();
  const updateNoticia = useUpdateNoticiaMutation(id);
  const submitting = isEdit ? updateNoticia.isPending : createNoticia.isPending;

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
        title: t("noticias:form.missingDataTitle"),
        message: t("noticias:form.missingDataMessage"),
      });
      return;
    }
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

      const data = isEdit
        ? await updateNoticia.mutateAsync(fd)
        : await createNoticia.mutateAsync(fd);

      addToast({
        type: "success",
        title:
          status === "draft"
            ? t("noticias:form.draftSavedTitle")
            : t("noticias:form.publishedTitle"),
        message:
          status === "draft"
            ? t("noticias:form.draftSavedMessage")
            : t("noticias:form.publishedMessage"),
      });
      navigate(`/noticias/${data._id}`);
    } catch (err) {
      addToast({
        type: "error",
        title: t("noticias:form.saveErrorTitle"),
        message:
          err.response?.data?.message || t("noticias:form.saveErrorMessage"),
      });
    }
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>
          {isEdit
            ? t("noticias:form.docTitleEdit", { brand: brandName })
            : t("noticias:form.docTitleCreate", { brand: brandName })}
        </title>
      </Helmet>
      <div className={styles.inner}>
        <BackButton to={isEdit ? `/noticias/${id}` : "/noticias"} flush>
          {isEdit
            ? t("noticias:form.backToNoticia")
            : t("noticias:form.backToNoticiero")}
        </BackButton>
        <header className={styles.hero}>
          <div className={styles.eyebrow}>
            <Meeple /> {t("noticias:form.eyebrow")}
          </div>
          <h1 className={styles.title}>
            {isEdit
              ? t("noticias:form.titleEdit")
              : t("noticias:form.titleCreate")}
          </h1>
          <p className={styles.sub}>{t("noticias:form.sub")}</p>
        </header>

        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${!showPreview ? styles.toggleActive : ""}`}
            onClick={() => setShowPreview(false)}
          >
            {t("noticias:form.tabEdit")}
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${showPreview ? styles.toggleActive : ""}`}
            onClick={() => setShowPreview(true)}
          >
            {t("noticias:form.tabPreview")}
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
                <span className={styles.label}>
                  {t("noticias:form.captionLabel")}
                </span>
                <input
                  className={styles.input}
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  maxLength={200}
                  placeholder={t("noticias:form.captionPlaceholder")}
                />
              </label>
            )}

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>
                  {t("noticias:form.categoryLabel")}
                </span>
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
                <span className={styles.label}>
                  {t("noticias:form.kickerLabel")}
                </span>
                <input
                  className={styles.input}
                  value={kicker}
                  onChange={(e) => setKicker(e.target.value)}
                  maxLength={60}
                  placeholder={t("noticias:form.kickerPlaceholder")}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>
                {t("noticias:form.headlineLabel")}
              </span>
              <input
                className={`${styles.input} ${styles.titleInput}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder={t("noticias:form.headlinePlaceholder")}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t("noticias:form.dekLabel")}</span>
              <textarea
                className={styles.textarea}
                value={dek}
                onChange={(e) => setDek(e.target.value)}
                rows={2}
                maxLength={320}
                placeholder={t("noticias:form.dekPlaceholder")}
              />
            </label>

            <TagsInput tags={tags} setTags={setTags} />

            <div className={styles.field}>
              <span className={styles.label}>
                {t("noticias:form.bodyLabel")}
              </span>
              <RichTextEditor
                value={body}
                onChange={setBody}
                extended
                uploadUrl={API.noticias.INLINE_IMAGE}
                placeholder={t("noticias:form.bodyPlaceholder")}
                maxLength={40000}
              />
            </div>

            <details className={styles.extra}>
              <summary>{t("noticias:form.quoteSummary")}</summary>
              <label className={styles.field}>
                <span className={styles.label}>
                  {t("noticias:form.quoteTextLabel")}
                </span>
                <textarea
                  className={styles.textarea}
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  rows={2}
                  maxLength={400}
                  placeholder={t("noticias:form.quoteTextPlaceholder")}
                />
              </label>
              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>
                    {t("noticias:form.quoteAuthorLabel")}
                  </span>
                  <input
                    className={styles.input}
                    value={quoteAuthor}
                    onChange={(e) => setQuoteAuthor(e.target.value)}
                    maxLength={80}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>
                    {t("noticias:form.quoteContextLabel")}
                  </span>
                  <input
                    className={styles.input}
                    value={quoteContext}
                    onChange={(e) => setQuoteContext(e.target.value)}
                    maxLength={80}
                    placeholder={t("noticias:form.quoteContextPlaceholder")}
                  />
                </label>
              </div>
            </details>

            <details className={styles.extra}>
              <summary>{t("noticias:form.linkSummary")}</summary>
              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>
                    {t("noticias:form.linkUrlLabel")}
                  </span>
                  <input
                    className={styles.input}
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    maxLength={500}
                    placeholder={t("noticias:form.linkUrlPlaceholder")}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>
                    {t("noticias:form.linkLabelLabel")}
                  </span>
                  <input
                    className={styles.input}
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    maxLength={80}
                    placeholder={t("noticias:form.linkLabelPlaceholder")}
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
                  <Trans
                    i18nKey="noticias:form.featured"
                    components={{ strong: <strong /> }}
                  />
                </span>
              </label>
              <label className={styles.flag}>
                <input
                  type="checkbox"
                  checked={isBrief}
                  onChange={(e) => setIsBrief(e.target.checked)}
                />
                <span>
                  <Trans
                    i18nKey="noticias:form.isBrief"
                    components={{ strong: <strong /> }}
                  />
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
                {t("noticias:form.cancel")}
              </Link>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={submitting}
                onClick={() => submit("draft")}
              >
                {t("noticias:form.saveDraft")}
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={submitting}
              >
                {submitting ? t("noticias:form.saving") : t("noticias:form.publish")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
