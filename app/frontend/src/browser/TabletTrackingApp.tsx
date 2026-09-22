import { BrowserTrackingApp } from './BrowserTrackingApp';

export function TabletTrackingApp() {
  return (
    <>
      <BrowserTrackingApp
        layout="tablet"
        enableDebugOverlay={import.meta.env.DEV}
      />
    </>
  );
}