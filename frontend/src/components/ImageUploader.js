"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./ImageUploader.module.css";

export default function ImageUploader({ onImageSelected, disabled }) {
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const dragDepth = useRef(0);

  const handleFile = useCallback(
    (file) => {
      if (!file) return;

      setError("");

      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (JPEG, PNG, WebP).");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("Image too large. Max 10MB.");
        return;
      }

      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setPreview(dataUrl);
        onImageSelected(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelected]
  );

  const openFileDialog = () => {
    if (!disabled) inputRef.current?.click();
  };

  const resetImage = (event) => {
    event.stopPropagation();
    setPreview(null);
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
        onClick={openFileDialog}
        id="image-upload-zone"
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") openFileDialog();
        }}
        aria-label="Upload photo"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
          className={styles.hiddenInput}
          disabled={disabled}
          id="image-upload-input"
        />

        {preview ? (
          <div className={styles.previewWrap}>
            <img src={preview} alt="Uploaded photo preview" className={styles.previewImg} />
            <div className={styles.previewOverlay}>
              <span className={styles.previewTag}>Photo ready</span>
              <button
                className={styles.removeBtn}
                onClick={resetImage}
                id="remove-image-btn"
                type="button"
                disabled={disabled}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M1 1L13 13M13 1L1 13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Change photo
              </button>
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
                <p className={styles.primaryText}>Drop your photo here</p>
                <p className={styles.secondaryText}>
                  or <span className={styles.browseLink}>click to browse</span>
                </p>
                <p className={styles.hintText}>JPEG / PNG / WebP / Max 10MB</p>
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
