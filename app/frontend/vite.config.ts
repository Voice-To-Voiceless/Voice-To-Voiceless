import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function copyWebGazerAssets() {
  const copy = () => {
    const source = resolve(__dirname, 'node_modules/webgazer/dist/mediapipe/face_mesh');
    const destination = resolve(__dirname, 'public/webgazer/face_mesh');
    mkdirSync(destination, { recursive: true });
    cpSync(source, destination, { recursive: true, force: true });
  };
  return { name: 'copy-webgazer-assets', buildStart: copy, configureServer: copy };
}

export default defineConfig({
  plugins: [react(), copyWebGazerAssets()],
  build: {
    outDir: 'dist-web',
  },
});
