import { useState, useEffect, useRef } from "react";
import styles from "../Torneos.module.css";

export default function ImageDropzone({ preview, onFile }) {
  const inputRef = useRef(null);
  const onFileRef = useRef(onFile);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    onFileRef.current = onFile;
  }, [onFile]);

  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) {
            onFileRef.current(f);
            break;
          }
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const classes = [
    styles.dropzone,
    preview ? styles.dropzoneWithPreview : "",
    dragOver ? styles.dropzoneDragOver : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => inputRef.current?.click()}
    >
      {preview ? (
        <img src={preview} alt="preview" className={styles.dropzonePreview} />
      ) : (
        <div className={styles.dropzonePlaceholder}>
          <span className={styles.dropzoneIcon}>🖼</span>
          <span className={styles.dropzoneText}>
            Arrastrá, pegá o hacé click para subir un banner (opcional)
          </span>
          <span className={styles.dropzoneSub}>JPG, PNG, WEBP · máx. 5 MB</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className={styles.fileInput}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
