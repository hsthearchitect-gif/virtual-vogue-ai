"use client";

import { useCallback, useState } from "react";
import ImageUploader from "@/components/ImageUploader";
import LoadingSpinner from "@/components/LoadingSpinner";
import OutfitCarousel from "@/components/OutfitCarousel";
import ResultDisplay from "@/components/ResultDisplay";
import { generateTryOn } from "@/lib/api";
import styles from "./page.module.css";

async function imageUrlToDataUrl(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Could not load the selected outfit image.");
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Home() {
  const [humanImage, setHumanImage] = useState(null);
  const [selectedOutfit, setSelectedOutfit] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [loadingAttempt, setLoadingAttempt] = useState(0);
  const [resultImage, setResultImage] = useState(null);
  const [error, setError] = useState(null);
  const [trialsRemaining, setTrialsRemaining] = useState(null);

  const handleImageSelected = useCallback((image) => {
    setHumanImage(image);
    setResultImage(null);
    setError(null);
  }, []);

  const handleOutfitSelected = useCallback((outfit) => {
    setSelectedOutfit(outfit);
    setResultImage(null);
    setError(null);
  }, []);

  const runGeneration = useCallback(async () => {
    if (!humanImage || !selectedOutfit) return;

    setIsGenerating(true);
    setError(null);
    setResultImage(null);
    setLoadingStatus("starting");
    setLoadingAttempt(0);

    try {
      const garmentImage = await imageUrlToDataUrl(selectedOutfit.image);
      const response = await generateTryOn({
        humanImage,
        garmentImage,
        garmentDescription: selectedOutfit.description,
        category: selectedOutfit.category,
        onProgress: (status, attempt) => {
          setLoadingStatus(status);
          setLoadingAttempt(attempt);
        }
      });

      const output = Array.isArray(response.output) ? response.output[0] : response.output;

      if (!output) {
        throw new Error("No image returned. Please try again.");
      }

      setResultImage(output);

      if (response.trialsRemaining !== undefined) {
        setTrialsRemaining(response.trialsRemaining);
      }
    } catch (generationError) {
      setError({
        code: generationError.code || "GENERATION_FAILED",
        message: generationError.message || "Generation failed. Please try again."
      });
    } finally {
      setIsGenerating(false);
      setLoadingStatus("");
      setLoadingAttempt(0);
    }
  }, [humanImage, selectedOutfit]);

  const handleTryAnother = useCallback(() => {
    setResultImage(null);
    setError(null);
    setSelectedOutfit(null);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    runGeneration();
  }, [runGeneration]);

  const canGenerate = Boolean(humanImage && selectedOutfit && !isGenerating);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>V</div>
          <span className={styles.logoText}>
            Virtual <span className={styles.logoTextAccent}>Vogue</span> AI
          </span>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.catalogPill}>8 outfits</span>
        </div>
      </header>

      <section className={styles.hero}>
        <h1 className={styles.title}>
          AI Virtual <span className={styles.titleAccent}>Try-On Studio</span>
        </h1>
        <p className={styles.subtitle}>
          Upload a portrait, select a look, and generate a realistic outfit preview.
        </p>
      </section>

      <div className={styles.content}>
        <div className={styles.studioGrid}>
          <section className={`${styles.section} ${styles.uploadSection}`}>
            <div className={styles.sectionLabel}>
              <div className={styles.stepNumber}>1</div>
              <h2 className={styles.sectionTitle}>Photo</h2>
            </div>
            <ImageUploader onImageSelected={handleImageSelected} disabled={isGenerating} />
          </section>

          <section className={`${styles.section} ${styles.outfitSection}`}>
            <div className={styles.sectionLabel}>
              <div className={styles.stepNumber}>2</div>
              <h2 className={styles.sectionTitle}>Outfit</h2>
            </div>
            <OutfitCarousel onOutfitSelected={handleOutfitSelected} disabled={isGenerating} />
          </section>
        </div>

        {!isGenerating && !resultImage && (
          <div className={styles.actionBar}>
            <div className={styles.selectionState}>
              <span className={humanImage ? styles.readyState : styles.pendingState}>
                {humanImage ? "Photo ready" : "Photo needed"}
              </span>
              <span className={selectedOutfit ? styles.readyState : styles.pendingState}>
                {selectedOutfit ? selectedOutfit.name : "Outfit needed"}
              </span>
            </div>
            <button
              className={styles.tryNowBtn}
              onClick={runGeneration}
              disabled={!canGenerate}
              id="try-now-btn"
              type="button"
            >
              <span className={styles.tryNowBtnText}>Try Now</span>
              <span className={styles.tryNowBtnIcon} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M4 10H16M16 10L11 5M16 10L11 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </div>
        )}

        {isGenerating && (
          <section className={styles.section}>
            <LoadingSpinner status={loadingStatus} attempt={loadingAttempt} />
          </section>
        )}

        {(resultImage || error) && !isGenerating && (
          <section className={styles.resultSection}>
            <div className={styles.resultLabel}>
              <div className={styles.stepNumber}>3</div>
              <h2 className={styles.sectionTitle}>Your New Look</h2>
            </div>
            <ResultDisplay
              imageUrl={resultImage}
              error={error}
              onTryAnother={handleTryAnother}
              onRetry={handleRetry}
              trialsRemaining={trialsRemaining}
            />
          </section>
        )}
      </div>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          Powered by <span className={styles.footerAccent}>Virtual Vogue AI</span>
        </p>
      </footer>
    </main>
  );
}
