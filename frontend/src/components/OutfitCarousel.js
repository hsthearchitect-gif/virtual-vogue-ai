"use client";

import { useCallback, useState } from "react";
import { outfits } from "@/lib/outfits";
import WardrobeManager from "@/components/WardrobeManager";
import styles from "./OutfitCarousel.module.css";

export default function OutfitCarousel({
  disabled,
  isAuthConfigured,
  onOutfitSelected,
  user
}) {
  const [selectedKey, setSelectedKey] = useState(null);

  const selectOutfit = useCallback(
    (index) => {
      if (disabled) return;

      const outfit = outfits[index];
      setSelectedKey(`catalog:${outfit.id}`);

      onOutfitSelected({
        id: outfit.id,
        image: outfit.image,
        description: outfit.garmentDescription,
        category: outfit.category,
        name: outfit.name,
        source: "catalog"
      });
    },
    [disabled, onOutfitSelected]
  );

  const selectWardrobeGarment = useCallback(
    (garment) => {
      setSelectedKey(`wardrobe:${garment.id}`);
      onOutfitSelected(garment);
    },
    [onOutfitSelected]
  );

  const scrollCarousel = (direction) => {
    const track = document.getElementById("outfit-carousel-track");
    if (!track) return;

    const offset = direction === "left" ? -280 : 280;
    track.scrollTo({ left: track.scrollLeft + offset, behavior: "smooth" });
  };

  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ""}`}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Choose a Look</h3>
          <p className={styles.count}>
            {isAuthConfigured
              ? `${outfits.length} catalog styles plus your saved clothes`
              : `${outfits.length} catalog styles available`}
          </p>
        </div>
        <div className={styles.arrows}>
          <button
            className={styles.arrowBtn}
            onClick={() => scrollCarousel("left")}
            disabled={disabled}
            id="carousel-prev-btn"
            aria-label="Previous outfit"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M12 4L6 10L12 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className={styles.arrowBtn}
            onClick={() => scrollCarousel("right")}
            disabled={disabled}
            id="carousel-next-btn"
            aria-label="Next outfit"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M8 4L14 10L8 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <WardrobeManager
        disabled={disabled}
        isAuthConfigured={isAuthConfigured}
        onGarmentSelected={selectWardrobeGarment}
        selectedGarmentId={selectedKey?.startsWith("wardrobe:") ? selectedKey.replace("wardrobe:", "") : null}
        user={user}
      />

      <div className={styles.carouselWrapper}>
        <div className={styles.track} id="outfit-carousel-track">
          {outfits.map((outfit, index) => (
            <button
              className={`${styles.card} ${selectedKey === `catalog:${outfit.id}` ? styles.selected : ""}`}
              onClick={() => selectOutfit(index)}
              disabled={disabled}
              id={`outfit-card-${outfit.id}`}
              key={outfit.id}
              type="button"
            >
              <div className={styles.imageWrapper}>
                <img
                  src={outfit.image}
                  alt={outfit.name}
                  className={styles.outfitImage}
                  loading="lazy"
                />
                {selectedKey === `catalog:${outfit.id}` && (
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
              </div>
              <div className={styles.cardInfo}>
                <p className={styles.outfitName}>{outfit.name}</p>
                <p className={styles.outfitDesc}>{outfit.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
