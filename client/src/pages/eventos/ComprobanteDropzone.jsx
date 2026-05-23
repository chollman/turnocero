import { useEffect, useState } from 'react';
import FileDropzone from '../../components/shared/FileDropzone';
import { DocIcon, ImageIcon } from './EventoIcons';
import styles from './ComprobanteDropzone.module.css';

export default function ComprobanteDropzone({ file, onFile }) {
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

  return (
    <FileDropzone
      accept="image/jpeg,image/png,image/webp,application/pdf"
      onFile={onFile}
      ariaLabel="Subir comprobante"
      className={styles.dropzone}
      activeClassName={styles.active}
      dragOverClassName={styles.dragOver}
      hasFile={!!file}
    >
      {objectUrl ? (
        <img src={objectUrl} alt="comprobante" className={styles.preview} />
      ) : file ? (
        <div className={styles.pdfLabel}>
          <DocIcon size={22} />
          <span className={styles.fileName}>{file.name}</span>
          <span className={styles.changeText}>Hacé click para cambiar</span>
        </div>
      ) : (
        <div className={styles.empty}>
          <ImageIcon size={22} />
          <span className={styles.text}>Arrastrá o hacé click</span>
          <span className={styles.sub}>JPG · PNG · PDF · 10MB máx</span>
        </div>
      )}
    </FileDropzone>
  );
}
