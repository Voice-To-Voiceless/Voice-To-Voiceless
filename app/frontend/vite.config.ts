import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function copyOnnxRuntimeAssets() {
  const copy = () => {
    const source = resolve(__dirname, 'node_modules/onnxruntime-web/dist');
    const destination = resolve(__dirname, 'public/onnxruntime');
    mkdirSync(destination, { recursive: true });
    cpSync(source, destination, { recursive: true, force: true });
  };
  return { name: 'copy-onnxruntime-assets', buildStart: copy, configureServer: copy };
}

export default defineConfig({
  plugins: [react(), copyOnnxRuntimeAssets()],
  build: {
    outDir: 'dist-web',
  },
});
