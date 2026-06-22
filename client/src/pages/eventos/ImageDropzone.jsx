import { useTranslation } from "react-i18next";
import FileDropzone from "../../components/shared/FileDropzone";
import { ImageIcon } from "./EventoIcons";
import styles from "./ImageDropzone.module.css";

export default function ImageDropzone({
  preview,
  onFile,
  accept = "image/jpeg,image/png,image/webp,image/gif",
}) {
  const { t } = useTranslation("eventos");
  return (
    <FileDropzone
      accept={accept}
      onFile={onFile}
      ariaLabel={t("dropzone.imageAria")}
      className={styles.dropzone}
      activeClassName={styles.withPreview}
      dragOverClassName={styles.dragOver}
      hasFile={!!preview}
    >
      {preview ? (
        <img
          src={preview}
          alt={t("dropzone.imageAlt")}
          className={styles.preview}
        />
      ) : (
        <div className={styles.placeholder}>
          <ImageIcon size={28} />
          <span className={styles.text}>{t("dropzone.dragPasteClick")}</span>
          <span className={styles.sub}>{t("dropzone.imageFormats")}</span>
        </div>
      )}
    </FileDropzone>
  );
}
