"use client";

import styles from "./ResultDisplay.module.css";

export default function ResultDisplay({
  imageUrl,
  onTryAnother,
  error,
  onRetry,
  trialsRemaining
}) {
  const errorMessage = typeof error === "string" ? error : error?.message;
  const errorCode = typeof error === "string" ? "" : error?.code;
  const isLimitError =
    errorCode === "TRIAL_LIMIT_REACHED" ||
    errorMessage?.includes("free trials") ||
    errorMessage?.includes("429");
  const isCapacityError =
    errorCode === "PROVIDER_QUOTA_EXHAUSTED" ||
    errorMessage?.toLowerCase().includes("zerogpu") ||
    errorMessage?.toLowerCase().includes("gpu quota") ||
    errorMessage?.toLowerCase().includes("quota");
  const displayTitle = isLimitError
    ? "Daily Limit Reached"
    : isCapacityError
      ? "AI Capacity Temporarily Full"
      : "Something went wrong";
  const displayMessage = isCapacityError
    ? "The free AI provider has run out of GPU capacity for now. Start the Colab GPU notebook or configure fal.ai on the backend to keep generations available."
    : errorMessage;

  if (error) {
    return (
      <div className={styles.container} id="result-display">
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>
            {isLimitError ? (
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M24 13V24L31 29"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M24 16V26M24 32V32.01"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
          <h3 className={styles.errorTitle}>{displayTitle}</h3>
          <p className={styles.errorMessage}>{displayMessage}</p>
          {isLimitError && (
            <p className={styles.limitText}>Resets at midnight UTC.</p>
          )}
          {isCapacityError && (
            <p className={styles.limitText}>
              Best fix: use Colab as primary, or add FAL_KEY for reliable paid fallback.
            </p>
          )}
          <div className={styles.errorActions}>
            {!isLimitError && !isCapacityError && (
              <button className={styles.retryBtn} onClick={onRetry} id="retry-btn" type="button">
                Try Again
              </button>
            )}
            <button
              className={styles.resetBtn}
              onClick={onTryAnother}
              id="try-another-btn"
              type="button"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!imageUrl) return null;

  return (
    <div className={styles.container} id="result-display">
      <div className={styles.resultCard}>
        <div className={styles.badge}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 1L10.163 5.279L15 6.056L11.5 9.347L12.326 14L8 11.779L3.674 14L4.5 9.347L1 6.056L5.837 5.279L8 1Z"
              fill="currentColor"
            />
          </svg>
          AI Generated
        </div>

        <div className={styles.imageWrapper}>
          <img src={imageUrl} alt="Your AI-generated outfit look" className={styles.resultImage} />
        </div>

        <div className={styles.actions}>
          <a
            href={imageUrl}
            download="virtual-vogue-result.png"
            className={styles.downloadBtn}
            id="download-btn"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M9 2V12M9 12L5 8M9 12L13 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 14V15C2 15.5523 2.44772 16 3 16H15C15.5523 16 16 15.5523 16 15V14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Download
          </a>
          <button
            className={styles.tryAnotherBtn}
            onClick={onTryAnother}
            id="try-another-btn"
            type="button"
          >
            Try Another Look
          </button>
        </div>

        {trialsRemaining !== undefined && trialsRemaining !== null && (
          <p className={styles.trialText}>
            {trialsRemaining} free trial{trialsRemaining === 1 ? "" : "s"} remaining today
          </p>
        )}
      </div>
    </div>
  );
}
