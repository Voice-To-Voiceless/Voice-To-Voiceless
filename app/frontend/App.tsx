import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CommunicationScreen } from './src/screens/CommunicationScreen';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <CommunicationScreen />
    </SafeAreaProvider>
  );
}

export default App;
