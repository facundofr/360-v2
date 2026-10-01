import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base pública para servir la app bajo /afiliaciones/
  base: '/afiliaciones/',
  server: {
    host: true, // Permite acceso desde la red local para pruebas PWA
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'bootstrap-vendor': ['bootstrap', 'react-bootstrap']
        }
      }
    }
  },
  // Configuración PWA
  manifest: true, // Incluye el manifest en el build
  assetsInclude: ['**/*.png', '**/*.ico'] // Incluye iconos en los assets
})
