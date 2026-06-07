import { useCallback, useEffect, useState } from 'react';

// User-uploaded X-rays, stored in IndexedDB (images can exceed the localStorage
// quota, so IndexedDB is the right home). Each record matches the manifest case
// shape so uploads flow through the same Viewer / Interpreter / Library code,
// just flagged with `user: true` and no preset annotations.

const DB_NAME = 'dentalos-rad';
const STORE = 'cases';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDelete(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Read a File, downscaling very large images so storage and vision calls stay
// lean. Keeps small files untouched.
export async function fileToScaledDataUrl(file, maxDim = 1600) {
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Could not read the file.'));
    fr.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('That file is not a readable image.'));
    i.src = dataUrl;
  });
  const big = Math.max(img.naturalWidth, img.naturalHeight);
  if (big <= maxDim && (file.size || 0) < 1_200_000) return dataUrl;
  const scale = Math.min(1, maxDim / big);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export function useUserCases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    idbGetAll()
      .then((rows) => alive && setCases(rows.sort((a, b) => b.createdAt - a.createdAt)))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const add = useCallback(async ({ title, type, file }) => {
    const image = await fileToScaledDataUrl(file);
    const record = {
      id: `user-${Date.now().toString(36)}`,
      title: title || file.name.replace(/\.[^.]+$/, '') || 'Uploaded X-ray',
      type: type || 'other',
      difficulty: 'beginner',
      modality: 'image',
      image,
      pathologies: [],
      description: 'Your uploaded X-ray. Study it with the tools, calibrate to measure in mm, or open the Interpreter for AI feedback.',
      keyFindings: [],
      annotations: [],
      user: true,
      createdAt: Date.now()
    };
    await idbPut(record);
    setCases((prev) => [record, ...prev]);
    return record;
  }, []);

  const remove = useCallback(async (id) => {
    await idbDelete(id);
    setCases((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { cases, loading, add, remove };
}
