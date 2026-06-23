"use client";

import styles from "./AuthPanel.module.css";

export default function AuthPanel({
  authError,
  authReady,
  isAuthConfigured,
  onSignIn,
  onSignOut,
  user
}) {
  if (!isAuthConfigured) {
    return null;
  }

  if (!authReady) {
    return <span className={styles.setupPill}>Checking login</span>;
  }

  if (!user) {
    return (
      <div className={styles.authWrap}>
        <button className={styles.signInBtn} onClick={onSignIn} type="button">
          <span className={styles.googleMark} aria-hidden="true">G</span>
          Sign in
        </button>
        {authError && <span className={styles.errorText}>{authError}</span>}
      </div>
    );
  }

  return (
    <div className={styles.userWrap}>
      {user.photoURL ? (
        <img className={styles.avatar} src={user.photoURL} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className={styles.avatarFallback}>{user.displayName?.[0] || "U"}</span>
      )}
      <span className={styles.userName}>{user.displayName || user.email}</span>
      <button className={styles.signOutBtn} onClick={onSignOut} type="button">
        Sign out
      </button>
    </div>
  );
}
