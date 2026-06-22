import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { useTranslation } from "react-i18next";
import styles from "./AvatarCropModal.module.css";

async function getCroppedBlob(imageSrc, pixelCrop) {
  const img = new Image();
  img.src = imageSrc;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    600,
    600,
  );
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });
}

export default function AvatarCropModal({ open, file, onCancel, onConfirm }) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const objectUrlRef = useRef(null);

  // Generate the object URL for the picked file inside an effect (not during
  // render — ref reads/writes are not allowed in the render phase). The effect
  // also handles cleanup whenever `file` changes and on unmount.
  useEffect(() => {
    if (!file) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageSrc(url);
    return () => {
      URL.revokeObjectURL(url);
      if (objectUrlRef.current === url) objectUrlRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open, file]);

  const handleCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      if (blob) await onConfirm(blob);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !imageSrc) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t("shared:avatarCrop.overlayAria")}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>{t("shared:avatarCrop.title")}</h3>
        </div>

        <div className={styles.cropArea}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className={styles.controls}>
          <label className={styles.zoomLabel}>
            <span>{t("shared:avatarCrop.zoom")}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className={styles.zoomSlider}
              aria-label={t("shared:avatarCrop.zoom")}
            />
          </label>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onCancel}
            disabled={saving}
          >
            {t("common:actions.cancel")}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={saving || !croppedAreaPixels}
          >
            {saving ? t("shared:avatarCrop.saving") : t("common:actions.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
