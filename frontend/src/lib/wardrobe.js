"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "firebase/firestore";
import {
  deleteObject,
  getBlob,
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";
import { db, isFirebaseConfigured, storage } from "@/lib/firebase";

const MAX_GARMENT_IMAGE_SIZE_MB = 20;
const MOBILE_IMAGE_EXTENSIONS = /\.(heic|heif)$/i;
const MAX_GARMENT_DIMENSION = 1600;

function cleanFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function createUploadId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error("Could not read garment image."));
    reader.readAsDataURL(blob);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode garment image."));
    image.src = url;
  });
}

function canvasToJpegBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not prepare garment image."));
      },
      "image/jpeg",
      0.9
    );
  });
}

async function normalizeGarmentImage(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = largestSide > MAX_GARMENT_DIMENSION ? MAX_GARMENT_DIMENSION / largestSide : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    return {
      blob: await canvasToJpegBlob(canvas),
      contentType: "image/jpeg",
      fileName: `${file.name?.replace(/\.[^.]+$/, "") || "garment"}.jpg`
    };
  } catch {
    return {
      blob: file,
      contentType: file.type || "image/jpeg",
      fileName: file.name || "garment.jpg"
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function canUseWardrobe() {
  return isFirebaseConfigured && db && storage;
}

export function subscribeToWardrobe(user, onItems, onError) {
  if (!canUseWardrobe() || !user?.uid) {
    onItems([]);
    return () => {};
  }

  const garmentsQuery = query(
    collection(db, "users", user.uid, "garments"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    garmentsQuery,
    (snapshot) => {
      onItems(
        snapshot.docs.map((garmentDoc) => ({
          id: garmentDoc.id,
          ...garmentDoc.data()
        }))
      );
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function uploadWardrobeGarment({ user, file, name, category }) {
  if (!canUseWardrobe()) {
    throw new Error("Google login and wardrobe storage are not configured yet.");
  }

  if (!user?.uid) {
    throw new Error("Sign in before saving clothes.");
  }

  const isImage = file?.type?.startsWith("image/") || MOBILE_IMAGE_EXTENSIONS.test(file?.name || "");

  if (!isImage) {
    throw new Error("Please upload an image of the clothing item.");
  }

  if (file.size > MAX_GARMENT_IMAGE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Clothing image is too large. Max ${MAX_GARMENT_IMAGE_SIZE_MB}MB.`);
  }

  const uploadId = createUploadId();
  const normalized = await normalizeGarmentImage(file);
  const safeName = cleanFileName(normalized.fileName || `${uploadId}.jpg`);
  const storagePath = `users/${user.uid}/wardrobe/${uploadId}-${safeName}`;
  const storageReference = ref(storage, storagePath);

  await uploadBytes(storageReference, normalized.blob, {
    contentType: normalized.contentType,
    customMetadata: {
      ownerId: user.uid,
      source: "virtual-vogue-ai"
    }
  });

  const imageUrl = await getDownloadURL(storageReference);
  const garmentName = name?.trim() || file.name?.replace(/\.[^.]+$/, "") || "Saved garment";
  const garmentDescription = `${garmentName} uploaded by the user`;

  const garmentRef = await addDoc(collection(db, "users", user.uid, "garments"), {
    category,
    createdAt: serverTimestamp(),
    garmentDescription,
    imageUrl,
    name: garmentName,
    originalFileName: file.name || "",
    storagePath
  });

  return {
    category,
    garmentDescription,
    id: garmentRef.id,
    imageUrl,
    name: garmentName,
    storagePath
  };
}

export async function deleteWardrobeGarment(user, garment) {
  if (!canUseWardrobe() || !user?.uid || !garment?.id) return;

  await deleteDoc(doc(db, "users", user.uid, "garments", garment.id));

  if (garment.storagePath) {
    await deleteObject(ref(storage, garment.storagePath)).catch(() => {});
  }
}

export async function storagePathToDataUrl(storagePath) {
  if (!canUseWardrobe() || !storagePath) {
    throw new Error("Saved garment storage is not available.");
  }

  const blob = await getBlob(ref(storage, storagePath));
  return blobToDataUrl(blob);
}
