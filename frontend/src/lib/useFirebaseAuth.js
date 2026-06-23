"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";

export function useFirebaseAuth() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!auth) return undefined;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setAuthError("");
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth || !googleProvider) {
      setAuthError("Google login is not configured yet.");
      return;
    }

    setAuthError("");

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(error?.message || "Google login failed.");
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (!auth) return;

    setAuthError("");

    try {
      await signOut(auth);
    } catch (error) {
      setAuthError(error?.message || "Sign out failed.");
    }
  }, []);

  return {
    authError,
    authReady,
    isAuthConfigured: isFirebaseConfigured,
    signInWithGoogle,
    signOutUser,
    user
  };
}
