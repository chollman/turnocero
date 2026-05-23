import { useRef, useState } from "react";
import axios from "axios";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { API } from "../../api/endpoints";
import styles from "./TableDetail.module.css";

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
      const { data } = await axios.post(
        API.tables.IMAGES(tableId),
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
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

  return (
    <>
      <div className={`${styles.card} ${className}`}>
        <div className={styles.galleryHeader}>
          <span className={styles.eyebrow}>
            FOTOS DE LA MESA
            {images.length > 0 && (
              <span className={styles.galleryBadge}>{images.length}/10</span>
            )}
          </span>
          {canUpload && (
            <>
              <button
                className={styles.btnUpload}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Subiendo…" : "+ Foto"}
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
        </div>
        {error && <p className={styles.galleryError}>{error}</p>}
        {images.length === 0 ? (
          <p className={styles.galleryEmpty}>
            {canUpload
              ? "Todavía no hay fotos. ¡Subí la primera!"
              : "Todavía no hay fotos."}
          </p>
        ) : (
          <div className={styles.imageGrid}>
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
                    {img.uploader.username}
                  </span>
                )}
              </div>
            ))}
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
