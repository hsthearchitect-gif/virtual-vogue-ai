"use client";

import { useEffect, useState } from "react";
import styles from "./LoadingSpinner.module.css";

const messages = [
  "Analyzing your photo...",
  "Detecting body pose...",
  "Processing garment texture...",
  "Fitting outfit to your body...",
  "Blending fabric details...",
  "Refining the result...",
  "Almost ready..."
];

export default function LoadingSpinner({ status, attempt }) {
  const [seconds, setSeconds] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(
      () => setMessageIndex((value) => (value + 1) % messages.length),
      8000
    );
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(seconds / 60);
  const paddedSeconds = String(seconds % 60).padStart(2, "0");
  const elapsed = minutes > 0 ? `${minutes}m ${paddedSeconds}s` : `${seconds}s`;
  const progress = Math.min((seconds / 120) * 100, 92);

  return (
    <div className={styles.container} id="loading-spinner">
      <div className={styles.spinnerWrapper}>
        <div className={styles.spinner}>
          <div className={styles.ring} />
          <div className={styles.ring} />
          <div className={styles.ring} />
        </div>
      </div>

      <div className={styles.textContent}>
        <p className={styles.message}>{messages[messageIndex]}</p>
        <p className={styles.subMessage}>
          {elapsed} elapsed - AI model is processing your image
        </p>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%`, transition: "width 1s linear" }}
          />
        </div>
        <p className={styles.statusText}>
          {status || "processing"} {attempt ? `- attempt ${attempt}` : ""}
        </p>
      </div>

      <div className={styles.dots} aria-hidden="true">
        <span className={styles.dot} style={{ animationDelay: "0s" }} />
        <span className={styles.dot} style={{ animationDelay: "0.2s" }} />
        <span className={styles.dot} style={{ animationDelay: "0.4s" }} />
      </div>
    </div>
  );
}
