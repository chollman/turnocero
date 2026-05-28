import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { API } from "../../api/endpoints";
import styles from "./TableDetail.module.css";

const PlusIcon = ({ size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CameraIcon = ({ size = 36 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// Sección "Fotos de la mesa". El padre owna `images` porque también lo
// necesita para hidratar `table.images` después del upload — paso el
// callback `onImagesChange` para que el padre quede en sync sin que
// tengamos que duplicar el state.
//
// El lightbox (zoom de la imagen) es state interno: nadie más lo usa.
export default function TableGallery({
  tableId,
  images,
  canUpload,
  canDeleteImage,
  onImagesChange,
  className = "",
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [lightboxImage, setLightboxImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError("");
    setUploading(true);
    const formData = new FormData();
    formData.append("image", file);
    try {
      const { data } = await axios.post(API.tables.IMAGES(tableId), formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onImagesChange?.(data);
    } catch (err) {
      setError(getErrorMessage(err, "Error al subir la imagen"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId) => {
    if (!window.confirm("¿Eliminar esta imagen?")) return;
    setError("");
    try {
      await axios.delete(API.tables.IMAGE_DETAIL(tableId, imageId));
      onImagesChange?.(images.filter((img) => img._id !== imageId));
    } catch (err) {
      setError(getErrorMessage(err, "Error al eliminar la imagen"));
    }
  };

  const showGrid = canUpload || images.length > 0;

  return (
    <>
      <div className={`${styles.card} ${className}`}>
        {error && <p className={styles.galleryError}>{error}</p>}
        {showGrid ? (
          <div className={styles.imageGrid}>
            {canUpload && (
              <>
                <button
                  type="button"
                  className={styles.galleryAddTile}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="+ Foto"
                >
                  <PlusIcon size={28} />
                  <span>{uploading ? "Subiendo…" : "Subir foto"}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={handleUpload}
                />
              </>
            )}
            {images.map((img) => (
              <div key={img._id} className={styles.imageThumb}>
                <img
                  src={img.url}
                  alt="Foto de la mesa"
                  className={styles.thumbImg}
                  onClick={() => setLightboxImage(img.url)}
                />
                {canDeleteImage?.(img) && (
                  <button
                    className={styles.btnDeleteImg}
                    onClick={() => handleDelete(img._id)}
                    title="Eliminar imagen"
                    aria-label="Eliminar imagen"
                  >
                    ✕
                  </button>
                )}
                {img.uploader?.username && (
                  <span className={styles.uploaderLabel}>
                    {img.uploader._id ? (
                      <Link
                        to={`/usuarios/${img.uploader._id}`}
                        className={styles.userLink}
                      >
                        {img.uploader.username}
                      </Link>
                    ) : (
                      img.uploader.username
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.galleryEmpty}>
            <CameraIcon size={36} />
            <span>Todavía no hay fotos.</span>
          </div>
        )}
      </div>
      {lightboxImage && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Vista ampliada"
            className={styles.lightboxImg}
          />
        </div>
      )}
    </>
  );
}
