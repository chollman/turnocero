import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import FileDropzone from "../../components/shared/FileDropzone";
import { DocIcon, ImageIcon } from "./EventoIcons";
import styles from "./ComprobanteDropzone.module.css";

export default function ComprobanteDropzone({ file, onFile }) {
  const { t } = useTranslation("eventos");
  const [objectUrl, setObjectUrl] = useState(null);
  const isPdf = file?.type === "application/pdf";

  useEffect(() => {
    if (!file || isPdf) {
      setObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isPdf]);

  return (
    <FileDropzone
      accept="image/jpeg,image/png,image/webp,application/pdf"
      onFile={onFile}
      ariaLabel={t("dropzone.comprobanteAria")}
      className={styles.dropzone}
      activeClassName={styles.active}
      dragOverClassName={styles.dragOver}
      hasFile={!!file}
    >
      {objectUrl ? (
        <img
          src={objectUrl}
          alt={t("dropzone.comprobanteAlt")}
          className={styles.preview}
        />
      ) : file ? (
        <div className={styles.pdfLabel}>
          <DocIcon size={22} />
          <span className={styles.fileName}>{file.name}</span>
          <span className={styles.changeText}>{t("dropzone.changeText")}</span>
        </div>
      ) : (
        <div className={styles.empty}>
          <ImageIcon size={22} />
          <span className={styles.text}>{t("dropzone.dragOrClick")}</span>
          <span className={styles.sub}>{t("dropzone.comprobanteFormats")}</span>
        </div>
      )}
    </FileDropzone>
  );
}
