import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BrowserTrackingApp } from './src/browser/BrowserTrackingApp';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <BrowserTrackingApp />
    </SafeAreaProvider>
  );
}

export default App;
