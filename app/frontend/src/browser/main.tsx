import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserTrackingApp } from './BrowserTrackingApp';
import './browserStyles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserTrackingApp />
  </React.StrictMode>,
);