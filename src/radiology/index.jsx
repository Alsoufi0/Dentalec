import React, { useMemo } from 'react';
import './radiology.css';
import { useCases } from './useCases';
import { useBookmarks } from './useLocalStore';
import { useUserCases } from './userCases';
import RadiologyViewer from './RadiologyViewer.jsx';
import CaseLibrary from './CaseLibrary.jsx';
import XrayInterpreter from './XrayInterpreter.jsx';

// Page wrappers for the three radiology routes. They share one merged case list
// (manifest teaching cases + the user's uploaded X-rays), the selected case id,
// and bookmarks.

function useAllCases() {
  const manifest = useCases();
  const user = useUserCases();
  const cases = useMemo(() => [...user.cases, ...manifest.cases], [user.cases, manifest.cases]);
  return {
    cases,
    loading: manifest.loading || user.loading,
    error: manifest.error,
    addUserCase: user.add,
    removeUserCase: user.remove
  };
}

export function CasesPage({ setCaseId, navigate }) {
  const { cases, loading, error, addUserCase, removeUserCase } = useAllCases();
  const bookmarks = useBookmarks();
  return (
    <CaseLibrary
      cases={cases}
      loading={loading}
      error={error}
      bookmarks={bookmarks}
      onOpen={(id) => { setCaseId(id); navigate('radiology'); }}
      onUpload={addUserCase}
      onDelete={removeUserCase}
    />
  );
}

export function RadiologyPage({ caseId, navigate }) {
  const { cases, loading, error, removeUserCase } = useAllCases();
  const current = cases.find((c) => c.id === caseId) || cases[0] || null;

  if (loading) return <div className="rad-mod"><div className="cl-loading">Loading viewer…</div></div>;
  if (error) return <div className="rad-mod"><div className="cl-error">Could not load cases: {error}</div></div>;

  return (
    <div className="rad-mod">
      <RadiologyViewer
        key={current?.id}
        case={current}
        onBack={() => navigate('cases')}
        onDelete={async (id) => { await removeUserCase(id); navigate('cases'); }}
      />
    </div>
  );
}

export function InterpreterPage({ caseId, setCaseId }) {
  const { cases, loading, error } = useAllCases();
  return (
    <XrayInterpreter
      cases={cases}
      loading={loading}
      error={error}
      caseId={caseId}
      setCaseId={setCaseId}
    />
  );
}
