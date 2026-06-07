import { useEffect, useState } from 'react';

// Loads the radiology case manifest once and caches it for the session. The
// manifest (public/radiology/manifest.json) is the single source of truth for
// every case shown in the Case Library, Viewer, and Interpreter.

let cache = null;
let inflight = null;

export function useCases() {
  const [state, setState] = useState(() =>
    cache ? { cases: cache, loading: false, error: '' } : { cases: [], loading: true, error: '' }
  );

  useEffect(() => {
    if (cache) return;
    let alive = true;
    inflight =
      inflight ||
      fetch('/radiology/manifest.json')
        .then((res) => {
          if (!res.ok) throw new Error(`manifest ${res.status}`);
          return res.json();
        })
        .then((json) => {
          cache = Array.isArray(json.cases) ? json.cases : [];
          return cache;
        });
    inflight
      .then((cases) => alive && setState({ cases, loading: false, error: '' }))
      .catch((err) => {
        inflight = null;
        if (alive) setState({ cases: [], loading: false, error: err.message || 'Failed to load cases' });
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

export function useCase(caseId) {
  const { cases, loading, error } = useCases();
  return { case: cases.find((c) => c.id === caseId) || null, cases, loading, error };
}
