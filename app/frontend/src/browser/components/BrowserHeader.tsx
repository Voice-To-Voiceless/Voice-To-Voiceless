import React from 'react';

type Props = { tracking: boolean };

export function BrowserHeader({ tracking }: Props) {
  return <header className="app-header">
    <div><p className="eyebrow">V2VL EYE TRACKING PROTOTYPE</p><h1>How can we help?</h1></div>
    <span className={tracking ? 'connection-badge ready' : 'connection-badge'}>
      <span className="connection-dot" />{tracking ? 'Tracking live' : 'Touch fallback'}
    </span>
  </header>;
}
