import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Base44 eliminado por decisión del usuario (build de Vercel fallaba en
// "Cannot find package '@base44/vite-plugin'"). El plugin de Base44 solo
// aportaba herramientas de la plataforma Base44 (HMR notifier, analytics,
// visual edit agent) — nada necesario para compilar ni ejecutar Vivi.
//
// IMPORTANTE: el plugin de Base44 también resolvía el alias '@/' → 'src/'.
// Al quitarlo, ese alias debe declararse aquí explícitamente — sin esto,
// TODOS los imports '@/...' del proyecto romperían el build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Necesario para el top-level await de src/api/base44Client.js
    // (carga perezosa y opcional del SDK de Base44 solo si está configurado).
    target: 'es2022',
  },
});
