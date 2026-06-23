"use client";

import { useCallback, useEffect, useState } from "react";
import {
  canUseWardrobe,
  deleteWardrobeGarment,
  subscribeToWardrobe,
  uploadWardrobeGarment
} from "@/lib/wardrobe";
import styles from "./WardrobeManager.module.css";

function getGarmentName(file) {
  const name = file?.name?.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return name || "Uploaded clothing";
}

function toSelectableGarment(garment) {
  return {
    category: garment.category,
    dataUrl: garment.dataUrl,
    description: "Saved wardrobe item",
    garmentDescription: garment.garmentDescription,
    id: garment.id,
    image: garment.dataUrl,
    name: garment.name,
    source: "wardrobe"
  };
}

export default function WardrobeManager({
  disabled,
  onGarmentSelected,
  selectedGarmentId,
  trackId = "user-clothes-track"
}) {
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canUseWardrobe()) {
      setItems([]);
      setError("This browser cannot save clothes locally.");
      return undefined;
    }

    return subscribeToWardrobe(
      setItems,
      (subscriptionError) => {
        setError(subscriptionError?.message || "Could not load wardrobe.");
      }
    );
  }, []);

  const saveFile = useCallback(
    async (file) => {
      if (!file || disabled || isSaving) return;

      setIsSaving(true);
      setError("");
      setStatus("Adding clothing");

      try {
        const saved = await uploadWardrobeGarment({
          file,
          name: getGarmentName(file)
        });

        setStatus("Added to User Clothes");
        onGarmentSelected(toSelectableGarment(saved));
      } catch (saveError) {
        setError(saveError?.message || "Could not save garment.");
        setStatus("");
      } finally {
        setIsSaving(false);
      }
    },
    [disabled, isSaving, onGarmentSelected]
  );

  const selectGarment = useCallback(
    (garment) => {
      if (disabled) return;
      onGarmentSelected(toSelectableGarment(garment));
    },
    [disabled, onGarmentSelected]
  );

  const removeGarment = useCallback(
    async (event, garment) => {
      event.stopPropagation();
      if (disabled) return;

      setError("");
      setStatus("");

      try {
        await deleteWardrobeGarment(garment);
      } catch (deleteError) {
        setError(deleteError?.message || "Could not delete garment.");
      }
    },
    [disabled]
  );

  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ""}`}>
      <div className={styles.metaRow}>
        <p className={styles.savedCount}>{items.length ? `${items.length} saved` : "No saved clothes yet"}</p>
        {(status || error) && (
          <p className={error ? styles.errorText : styles.statusText}>{error || status}</p>
        )}
      </div>

      <div className={styles.carouselWrapper}>
        <div className={styles.track} id={trackId}>
          <label
            className={`${styles.card} ${styles.uploadCard}`}
            aria-disabled={disabled || isSaving}
          >
            <div className={styles.uploadImageWrapper}>
              <span className={styles.uploadIcon} aria-hidden="true">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 16V5M12 5L8 9M12 5L16 9"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 15V18C5 18.6 5.4 19 6 19H18C18.6 19 19 18.6 19 18V15"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </div>
            <div className={styles.cardInfo}>
              <p className={styles.outfitName}>{isSaving ? "Adding" : "Upload Clothing"}</p>
              <p className={styles.outfitDesc}>JPG, PNG, WebP</p>
            </div>
            <input
              className={styles.fileInput}
              type="file"
              accept="image/*,.heic,.heif"
              disabled={disabled || isSaving}
              onChange={(event) => {
                saveFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>

          {items.map((garment) => (
            <div
              className={`${styles.card} ${selectedGarmentId === garment.id ? styles.selected : ""}`}
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
              <div className={styles.imageWrapper}>
                <img src={garment.dataUrl} alt={garment.name} className={styles.outfitImage} />
                {selectedGarmentId === garment.id && (
                  <div className={styles.checkmark} aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="12" fill="var(--accent)" />
                      <path
                        d="M7 12.5L10.5 16L17 9"
                        stroke="var(--text-inverse)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
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
              <div className={styles.cardInfo}>
                <p className={styles.outfitName}>{garment.name}</p>
                <p className={styles.outfitDesc}>User clothing</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
