import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { PWA_ENABLED } from './src/core/flags';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      selfDestroying: !PWA_ENABLED,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: PWA_ENABLED && {
        id: './',
        name: 'Ampli: расчёт электрощитка квартиры',
        short_name: 'Ampli',
        description: 'Нагрузки, автоматы, кабели и щиток квартиры по нормам Беларуси. Работает без интернета.',
        lang: 'ru',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#EDF0F3',
        theme_color: '#FFFFFF',
        categories: ['utilities', 'productivity'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      reporter: ['text', 'text-summary', 'html'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 }
    }
  }
});
