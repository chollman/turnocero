import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import styles from './AvatarCropModal.module.css';

async function getCroppedBlob(imageSrc, pixelCrop) {
  const img = new Image();
  img.src = imageSrc;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
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
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

export default function AvatarCropModal({ open, file, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);
  const objectUrlRef = useRef(null);

  const imageSrc = useMemo(() => {
    if (!file) return null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    return url;
  }, [file]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

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
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Recortar avatar">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Recortar avatar</h3>
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
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className={styles.zoomSlider}
              aria-label="Zoom"
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
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={saving || !croppedAreaPixels}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
