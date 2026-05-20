import { useRef, useState } from 'react';
import { ImageIcon } from './EventoIcons';
import styles from './ImageDropzone.module.css';

export default function ImageDropzone({ preview, onFile, accept = 'image/jpeg,image/png,image/webp,image/gif' }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

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
    preview ? styles.withPreview : '',
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
      aria-label="Subir imagen del evento"
    >
      {preview ? (
        <img src={preview} alt="preview" className={styles.preview} />
      ) : (
        <div className={styles.placeholder}>
          <ImageIcon size={28} />
          <span className={styles.text}>Arrastrá, pegá o hacé click</span>
          <span className={styles.sub}>JPG · PNG · WEBP · máx. 5 MB</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.input}
        onChange={handleChange}
      />
    </div>
  );
}
