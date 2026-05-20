import { useEffect, useRef, useState } from 'react';
import { DocIcon, ImageIcon } from './EventoIcons';
import styles from './ComprobanteDropzone.module.css';

export default function ComprobanteDropzone({ file, onFile }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [objectUrl, setObjectUrl] = useState(null);

  const isPdf = file?.type === 'application/pdf';

  useEffect(() => {
    if (!file || isPdf) {
      setObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isPdf]);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  function handleChange(e) {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  }

  const classes = [
    styles.dropzone,
    file ? styles.active : '',
    dragOver ? styles.dragOver : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-label="Subir comprobante"
    >
      {objectUrl ? (
        <img src={objectUrl} alt="comprobante" className={styles.preview} />
      ) : file ? (
        <div className={styles.pdfLabel}>
          <DocIcon size={22} />
          <span className={styles.fileName}>{file.name}</span>
          <span className={styles.changeText}>Click para cambiar</span>
        </div>
      ) : (
        <div className={styles.empty}>
          <ImageIcon size={22} />
          <span className={styles.text}>Arrastrá o hacé click</span>
          <span className={styles.sub}>JPG · PNG · PDF · 10MB máx</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className={styles.input}
        onChange={handleChange}
      />
    </div>
  );
}
