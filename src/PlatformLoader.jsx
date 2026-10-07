import React from 'react';

export default function PlatformLoader() {
  return (
    <div className="platform-loader-shell" role="status" aria-live="polite" aria-label="Loading">
      <div className="platform-loader-ambient" aria-hidden="true">
        <div className="platform-loader-orb orb-primary" />
        <div className="platform-loader-orb orb-secondary" />
        <div className="platform-loader-orb orb-accent" />
      </div>
      <div className="platform-loader-card">
        <span className="platform-loader-spinner" aria-hidden="true" />
        <p className="platform-loader-title">Loading...</p>
        <div className="platform-loader-track" aria-hidden="true">
          <div className="platform-loader-beam" />
        </div>
      </div>
    </div>
  );
}
