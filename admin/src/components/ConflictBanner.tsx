import React from 'react';

interface ConflictBannerProps {
  message: string;
  currentRevision: number;
  onReload: () => void;
}

export function ConflictBanner({ message, currentRevision, onReload }: ConflictBannerProps) {
  return (
    <div className="notice notice-warning conflict-banner" role="alert">
      <div>
        <strong>Newer changes are available</strong>
        <p>{message} The server is now at revision {currentRevision}.</p>
      </div>
      <button className="button button-secondary" type="button" onClick={onReload}>
        Reload current state
      </button>
    </div>
  );
}
