import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import crossOriginIsolation from 'vite-plugin-cross-origin-isolation'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), crossOriginIsolation()],
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          let extType = assetInfo.name.split('.').at(1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = 'img';
          }
          return `[name][extname]`;
        },
        chunkFileNames: '[name].js',
        entryFileNames: '[name].js',
      }
    }
  },
})
