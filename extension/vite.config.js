import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Custom plugin to copy manifest.json to dist
const copyManifestPlugin = () => {
  return {
    name: 'copy-manifest',
    generateBundle() {
      const manifestPath = resolve(__dirname, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = fs.readFileSync(manifestPath, 'utf-8');
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: manifest
        });
      }
    }
  };
};

export default defineConfig({
  plugins: [react(), copyManifestPlugin()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background/background.js'),
        content: resolve(__dirname, 'src/content/content.js'),
      },
      output: {
        entryFileNames: 'src/[name]/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
