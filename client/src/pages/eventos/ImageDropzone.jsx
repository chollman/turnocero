import FileDropzone from '../../components/shared/FileDropzone';
import { ImageIcon } from './EventoIcons';
import styles from './ImageDropzone.module.css';

export default function ImageDropzone({ preview, onFile, accept = 'image/jpeg,image/png,image/webp,image/gif' }) {
  return (
    <FileDropzone
      accept={accept}
      onFile={onFile}
      ariaLabel="Subir imagen del evento"
      className={styles.dropzone}
      activeClassName={styles.withPreview}
      dragOverClassName={styles.dragOver}
      hasFile={!!preview}
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
    </FileDropzone>
  );
}
