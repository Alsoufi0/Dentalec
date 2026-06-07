import { useCallback, useEffect, useState } from 'react';

// Tiny localStorage-backed state for bookmarks and interpreter scores. Keeps the
// radiology module's lightweight persistence in one place, with safe JSON
// parsing and SSR/no-storage fallbacks.

function read(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalStore(key, fallback) {
  const [value, setValue] = useState(() => read(key, fallback));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable: keep in-memory only */
    }
  }, [key, value]);

  return [value, setValue];
}

// Bookmarks: a set of case ids stored as an array.
export function useBookmarks() {
  const [ids, setIds] = useLocalStore('rad.bookmarks', []);
  const has = useCallback((id) => ids.includes(id), [ids]);
  const toggle = useCallback(
    (id) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [setIds]
  );
  return { ids, has, toggle };
}
