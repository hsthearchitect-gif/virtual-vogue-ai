"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ImageUploader.module.css";

const MAX_IMAGE_SIZE_MB = 20;
const MOBILE_IMAGE_EXTENSIONS = /\.(heic|heif)$/i;
const MAX_UPLOAD_DIMENSION = 1600;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not preview this image format."));
    image.src = url;
  });
}

async function normalizeImageForUpload(file, previewUrl) {
  try {
    const image = await loadImage(previewUrl);
    const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = largestSide > MAX_UPLOAD_DIMENSION ? MAX_UPLOAD_DIMENSION / largestSide : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.88);
  } catch {
    return readFileAsDataUrl(file);
  }
}

export default function ImageUploader({ onImageSelected, disabled }) {
  const [preview, setPreview] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const dragDepth = useRef(0);
  const previewUrlRef = useRef(null);
  const selectionTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const clearPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;

      const token = selectionTokenRef.current + 1;
      selectionTokenRef.current = token;
      setError("");
      setIsPreparing(false);

      const isImage = file.type.startsWith("image/") || MOBILE_IMAGE_EXTENSIONS.test(file.name);

      if (!isImage) {
        setError("Please upload an image file.");
        return;
      }

      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        setError(`Image too large. Max ${MAX_IMAGE_SIZE_MB}MB.`);
        return;
      }

      clearPreviewUrl();
      const nextPreviewUrl = URL.createObjectURL(file);
      previewUrlRef.current = nextPreviewUrl;
      setPreview(nextPreviewUrl);
      setFileName(file.name);
      setIsPreparing(true);
      onImageSelected(null);

      try {
        const dataUrl = await normalizeImageForUpload(file, nextPreviewUrl);
        if (selectionTokenRef.current !== token) return;
        onImageSelected(dataUrl);
      } catch {
        if (selectionTokenRef.current !== token) return;
        setError("This image could not be loaded. Please try another photo.");
        setPreview(null);
        setFileName("");
        onImageSelected(null);
        clearPreviewUrl();
      } finally {
        if (selectionTokenRef.current === token) setIsPreparing(false);
      }
    },
    [clearPreviewUrl, onImageSelected]
  );

  const resetImage = (event) => {
    event?.stopPropagation();
    selectionTokenRef.current += 1;
    clearPreviewUrl();
    setPreview(null);
    setIsPreparing(false);
    setFileName("");
    setError("");
    onImageSelected(null);
  };

  return (
    <div className={styles.wrapper}>
      <div
        className={[
          styles.dropZone,
          isDragging ? styles.dragging : "",
          preview ? styles.hasPreview : "",
          disabled ? styles.disabled : ""
        ].join(" ")}
        onDragEnter={
          disabled
            ? undefined
            : (event) => {
                event.preventDefault();
                event.stopPropagation();
                dragDepth.current += 1;
                if (dragDepth.current === 1) setIsDragging(true);
              }
        }
        onDragOver={
          disabled
            ? undefined
            : (event) => {
                event.preventDefault();
                event.stopPropagation();
              }
        }
        onDragLeave={
          disabled
            ? undefined
            : (event) => {
                event.preventDefault();
                event.stopPropagation();
                dragDepth.current -= 1;
                if (dragDepth.current === 0) setIsDragging(false);
              }
        }
        onDrop={
          disabled
            ? undefined
            : (event) => {
                event.preventDefault();
                event.stopPropagation();
                dragDepth.current = 0;
                setIsDragging(false);
                handleFile(event.dataTransfer.files?.[0]);
              }
        }
        id="image-upload-zone"
      >
        {preview ? (
          <div className={styles.previewWrap}>
            <img
              src={preview}
              alt="Uploaded photo preview"
              className={styles.previewImg}
              onError={() => setError("Preview unavailable, but the photo was selected.")}
            />
            <div className={styles.previewOverlay}>
              <span className={styles.previewTag}>{isPreparing ? "Preparing photo" : "Photo ready"}</span>
              <div className={styles.previewActions}>
                <label className={styles.overlayAction}>
                  Retake
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    capture="user"
                    onChange={(event) => {
                      handleFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                    className={styles.actionInput}
                    disabled={disabled}
                  />
                </label>
                <label className={styles.overlayAction}>
                  Gallery
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    onChange={(event) => {
                      handleFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                    className={styles.actionInput}
                    disabled={disabled}
                  />
                </label>
                <button
                  className={styles.removeBtn}
                  onClick={resetImage}
                  id="remove-image-btn"
                  type="button"
                  disabled={disabled}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            {isDragging ? (
              <div className={styles.dropIndicator}>
                <div className={styles.dropIcon}>
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                    <path
                      d="M20 28V12M20 12L13 19M20 12L27 19"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className={styles.dropText}>Drop it</p>
              </div>
            ) : (
              <>
                <div className={styles.uploadIconWrap}>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                    <path
                      d="M18 24V12M18 12L12 18M18 12L24 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 26V28C6 29.1046 6.89543 30 8 30H28C29.1046 30 30 29.1046 30 28V26"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className={styles.primaryText}>Add your photo</p>
                <div className={styles.uploadActions}>
                  <label className={styles.cameraAction}>
                    Take Photo
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
                      capture="user"
                      onChange={(event) => {
                        handleFile(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                      className={styles.actionInput}
                      disabled={disabled}
                      id="image-upload-input"
                    />
                  </label>
                  <label className={styles.galleryAction}>
                    Gallery
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
                      onChange={(event) => {
                        handleFile(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                      className={styles.actionInput}
                      disabled={disabled}
                    />
                  </label>
                </div>
                <p className={styles.hintText}>JPEG / PNG / WebP / Max {MAX_IMAGE_SIZE_MB}MB</p>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}
      {fileName && !error && <p className={styles.fileNameText}>{fileName}</p>}
    </div>
  );
}
