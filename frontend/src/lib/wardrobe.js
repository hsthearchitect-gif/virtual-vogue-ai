"use client";

const DB_NAME = "virtual-vogue-wardrobe";
const DB_VERSION = 1;
const STORE_NAME = "garments";
const WARDROBE_EVENT = "virtual-vogue-wardrobe-updated";
const MAX_GARMENT_IMAGE_SIZE_MB = 20;
const MAX_GARMENT_DIMENSION = 1400;
const MOBILE_IMAGE_EXTENSIONS = /\.(heic|heif)$/i;

let dbPromise = null;

function createId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openWardrobeDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("This browser cannot save clothes locally."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local wardrobe."));
  });

  return dbPromise;
}

async function runStore(mode, action) {
  const db = await openWardrobeDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Wardrobe storage failed."));
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

function canvasToDataUrl(canvas) {
  return canvas.toDataURL("image/jpeg", 0.88);
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error("Could not read garment image."));
    reader.readAsDataURL(file);
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

    return canvasToDataUrl(canvas);
  } catch {
    return fileToDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function notifyWardrobeUpdated() {
  globalThis.dispatchEvent?.(new Event(WARDROBE_EVENT));
}

function inferGarmentCategory(sourceText = "") {
  const text = sourceText.toLowerCase();

  if (/\b(dress|gown|jumpsuit|romper|sari|saree|lehenga)\b/.test(text)) {
    return "dresses";
  }

  if (/\b(pant|pants|trouser|trousers|jean|jeans|skirt|short|shorts|legging|leggings)\b/.test(text)) {
    return "lower_body";
  }

  return "upper_body";
}

export function canUseWardrobe() {
  return typeof window !== "undefined" && Boolean(globalThis.indexedDB);
}

export async function getWardrobeGarments() {
  const items = await runStore("readonly", (store) => store.getAll());
  return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function subscribeToWardrobe(onItems, onError) {
  if (!canUseWardrobe()) {
    onItems([]);
    return () => {};
  }

  let isActive = true;

  const load = () => {
    getWardrobeGarments()
      .then((items) => {
        if (isActive) onItems(items);
      })
      .catch((error) => {
        if (isActive) onError?.(error);
      });
  };

  load();
  globalThis.addEventListener(WARDROBE_EVENT, load);

  return () => {
    isActive = false;
    globalThis.removeEventListener(WARDROBE_EVENT, load);
  };
}

export async function uploadWardrobeGarment({ file, name, category: requestedCategory }) {
  if (!canUseWardrobe()) {
    throw new Error("This browser cannot save clothes locally.");
  }

  const isImage = file?.type?.startsWith("image/") || MOBILE_IMAGE_EXTENSIONS.test(file?.name || "");

  if (!isImage) {
    throw new Error("Please upload an image of the clothing item.");
  }

  if (file.size > MAX_GARMENT_IMAGE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Clothing image is too large. Max ${MAX_GARMENT_IMAGE_SIZE_MB}MB.`);
  }

  const garmentName = name?.trim() || file.name?.replace(/\.[^.]+$/, "") || "Saved garment";
  const category = requestedCategory || inferGarmentCategory(`${garmentName} ${file.name || ""}`);
  const dataUrl = await normalizeGarmentImage(file);
  const garment = {
    category,
    createdAt: Date.now(),
    dataUrl,
    garmentDescription: `${garmentName} uploaded clothing item`,
    id: createId(),
    imageUrl: dataUrl,
    name: garmentName,
    originalFileName: file.name || "",
    source: "wardrobe"
  };

  await runStore("readwrite", (store) => store.put(garment));
  notifyWardrobeUpdated();

  return garment;
}

export async function deleteWardrobeGarment(garment) {
  if (!canUseWardrobe() || !garment?.id) return;

  await runStore("readwrite", (store) => store.delete(garment.id));
  notifyWardrobeUpdated();
}
