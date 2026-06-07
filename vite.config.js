import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Cornerstone3D ships its DICOM codecs as ESM web workers + WASM. Excluding the
  // loader from dep pre-bundling lets Vite resolve those worker/wasm URLs
  // correctly; ES worker format matches Cornerstone's worker entry points.
  optimizeDeps: {
    exclude: ['@cornerstonejs/dicom-image-loader', '@cornerstonejs/core', '@cornerstonejs/tools']
  },
  worker: {
    format: 'es'
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://127.0.0.1:8787'
    }
  },
  preview: {
    host: '0.0.0.0'
  }
});
