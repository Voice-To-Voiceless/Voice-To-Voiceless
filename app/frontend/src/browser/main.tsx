import React from 'react';
import { createRoot } from 'react-dom/client';
import { DeviceTrackingApp } from './DeviceTrackingApp';
import '../styles/browser/browserBase.css';
import '../styles/browser/browserAccessibility.css';
import '../styles/browser/browserResponsive.css';
import '../styles/browser/browserCaregiver.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DeviceTrackingApp />
  </React.StrictMode>,
);