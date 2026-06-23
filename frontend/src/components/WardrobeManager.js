"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  canUseWardrobe,
  deleteWardrobeGarment,
  subscribeToWardrobe,
  uploadWardrobeGarment
} from "@/lib/wardrobe";
import styles from "./WardrobeManager.module.css";

const CATEGORY_OPTIONS = [
  { label: "Top / Jacket", value: "upper_body" },
  { label: "Pants / Skirt", value: "lower_body" },
  { label: "Dress", value: "dresses" }
];

function getGarmentName(file) {
  return file?.name?.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") || "";
}

export default function WardrobeManager({
  disabled,
  isAuthConfigured,
  onGarmentSelected,
  selectedGarmentId,
  user
}) {
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("upper_body");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const previewRef = useRef("");

  useEffect(() => {
    if (!user?.uid || !canUseWardrobe()) {
      setItems([]);
      return undefined;
    }

    return subscribeToWardrobe(
      user,
      setItems,
      (subscriptionError) => {
        setError(subscriptionError?.message || "Could not load wardrobe.");
      }
    );
  }, [user]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const handleFile = useCallback((nextFile) => {
    if (!nextFile) return;

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);

    const nextPreviewUrl = URL.createObjectURL(nextFile);
    previewRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setFile(nextFile);
    setName((currentName) => currentName || getGarmentName(nextFile));
    setError("");
    setStatus("");
  }, []);

  const clearDraft = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = "";
    }

    setFile(null);
    setPreviewUrl("");
    setName("");
    setCategory("upper_body");
  }, []);

  const saveGarment = useCallback(async () => {
    if (!file || !user?.uid || isSaving || disabled) return;

    setIsSaving(true);
    setError("");
    setStatus("Saving garment");

    try {
      const saved = await uploadWardrobeGarment({
        category,
        file,
        name,
        user
      });

      clearDraft();
      setStatus("Saved to wardrobe");
      onGarmentSelected({
        category: saved.category,
        description: "Saved wardrobe item",
        garmentDescription: saved.garmentDescription,
        id: saved.id,
        image: saved.imageUrl,
        name: saved.name,
        source: "wardrobe",
        storagePath: saved.storagePath
      });
    } catch (saveError) {
      setError(saveError?.message || "Could not save garment.");
      setStatus("");
    } finally {
      setIsSaving(false);
    }
  }, [category, clearDraft, disabled, file, isSaving, name, onGarmentSelected, user]);

  const selectGarment = useCallback(
    (garment) => {
      if (disabled) return;

      onGarmentSelected({
        category: garment.category,
        description: "Saved wardrobe item",
        garmentDescription: garment.garmentDescription,
        id: garment.id,
        image: garment.imageUrl,
        name: garment.name,
        source: "wardrobe",
        storagePath: garment.storagePath
      });
    },
    [disabled, onGarmentSelected]
  );

  const removeGarment = useCallback(
    async (event, garment) => {
      event.stopPropagation();
      if (disabled || !user?.uid) return;

      setError("");

      try {
        await deleteWardrobeGarment(user, garment);
      } catch (deleteError) {
        setError(deleteError?.message || "Could not delete garment.");
      }
    },
    [disabled, user]
  );

  if (!isAuthConfigured) {
    return null;
  }

  if (!user) {
    return (
      <div className={styles.noticePanel}>
        <p className={styles.noticeTitle}>Sign in to save your wardrobe</p>
        <p className={styles.noticeText}>Upload clothes once, then reuse them for future try-ons.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.panel} ${disabled ? styles.disabled : ""}`}>
      <div className={styles.uploadGrid}>
        <div className={styles.uploadControls}>
          <div className={styles.fileActions}>
            <label className={styles.primaryFileAction}>
              Add by Camera
              <input
                className={styles.fileInput}
                type="file"
                accept="image/*,.heic,.heif"
                capture="environment"
                disabled={disabled || isSaving}
                onChange={(event) => {
                  handleFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            <label className={styles.secondaryFileAction}>
              Gallery
              <input
                className={styles.fileInput}
                type="file"
                accept="image/*,.heic,.heif"
                disabled={disabled || isSaving}
                onChange={(event) => {
                  handleFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          <input
            className={styles.nameInput}
            type="text"
            value={name}
            placeholder="Garment name"
            disabled={disabled || isSaving}
            onChange={(event) => setName(event.target.value)}
          />

          <select
            className={styles.categorySelect}
            value={category}
            disabled={disabled || isSaving}
            onChange={(event) => setCategory(event.target.value)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className={styles.saveRow}>
            <button
              className={styles.saveBtn}
              type="button"
              disabled={!file || disabled || isSaving}
              onClick={saveGarment}
            >
              {isSaving ? "Saving" : "Save Clothing"}
            </button>
            {file && (
              <button
                className={styles.clearBtn}
                type="button"
                disabled={disabled || isSaving}
                onClick={clearDraft}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className={styles.previewBox}>
          {previewUrl ? (
            <img src={previewUrl} alt="Garment preview" className={styles.previewImg} />
          ) : (
            <span className={styles.previewPlaceholder}>Clothing preview</span>
          )}
        </div>
      </div>

      {(status || error) && (
        <p className={error ? styles.errorText : styles.statusText}>{error || status}</p>
      )}

      <div className={styles.savedHeader}>
        <h4 className={styles.savedTitle}>Your Wardrobe</h4>
        <span className={styles.savedCount}>{items.length} saved</span>
      </div>

      {items.length > 0 ? (
        <div className={styles.savedGrid}>
          {items.map((garment) => (
            <div
              className={`${styles.savedCard} ${selectedGarmentId === garment.id ? styles.selected : ""}`}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled}
              aria-pressed={selectedGarmentId === garment.id}
              onClick={() => selectGarment(garment)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectGarment(garment);
                }
              }}
              key={garment.id}
            >
              <img src={garment.imageUrl} alt={garment.name} className={styles.savedImage} />
              <span className={styles.savedName}>{garment.name}</span>
              <button
                className={styles.deleteBtn}
                type="button"
                disabled={disabled}
                onClick={(event) => removeGarment(event, garment)}
                aria-label={`Delete ${garment.name}`}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyNotice}>No saved clothes yet.</div>
      )}
    </div>
  );
}
