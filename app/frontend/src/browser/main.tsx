import React from 'react';
import { createRoot } from 'react-dom/client';
import { DeviceTrackingApp } from './DeviceTrackingApp';
import './browserStyles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DeviceTrackingApp />
  </React.StrictMode>,
);