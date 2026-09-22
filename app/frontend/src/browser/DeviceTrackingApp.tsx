import { useEffect, useState } from 'react';
import { PhoneTrackingApp } from './PhoneTrackingApp';
import { TabletTrackingApp } from './TabletTrackingApp';

const PHONE_BREAKPOINT = 768;

function isPhoneViewport() {
  return window.innerWidth < PHONE_BREAKPOINT;
}

export function DeviceTrackingApp() {
  const [phone, setPhone] = useState(isPhoneViewport);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${PHONE_BREAKPOINT - 1}px)`);
    const updateDevice = () => setPhone(mediaQuery.matches);

    updateDevice();
    mediaQuery.addEventListener('change', updateDevice);
    return () => mediaQuery.removeEventListener('change', updateDevice);
  }, []);

  return phone ? <PhoneTrackingApp /> : <TabletTrackingApp />;
}