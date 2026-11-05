import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import { VitePWA } from 'vite-plugin-pwa';
import { PWA_ENABLED } from './src/core/flags';
import pkg from './package.json' with { type: 'json' };

const preset = reactCompilerPreset();
const compiler = { ...preset, rolldown: { ...preset.rolldown, applyToEnvironmentHook: undefined } };

const sha = (s: string): string => "'sha256-" + createHash('sha256').update(s).digest('base64') + "'";

const csp = (): Plugin => ({
  name: 'ampli-csp',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => sha(m[1]));
      const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => sha(m[1]));
      const policy = [
        "default-src 'self'",
        ["script-src 'self'", ...scripts].join(' '),
        ["style-src 'self'", ...styles].join(' '),
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'"
      ].join('; ');
      return html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + policy + '">');
    }
  }
});

const preloadFont = (match: RegExp): Plugin => ({
  name: 'ampli-preload-font',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      const font = Object.keys(ctx.bundle ?? {}).find(f => match.test(f));
      if (!font) return html;
      return html.replace('</title>', '</title>\n<link rel="preload" href="./' + font + '" as="font" type="font/woff2" crossorigin>');
    }
  }
});

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }] }
      }
    }
  },
  plugins: [
    csp(),
    react(),
    preloadFont(/golos-text-cyrillic-wght-normal-[^/]*\.woff2$/),
    babel({ presets: [compiler] }),
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
    environment: 'happy-dom',
    projects: [
      { extends: true, test: { name: 'shared', include: ['src/**/*.test.{ts,tsx}'], exclude: ['src/test/isolated/**'], isolate: false } },
      { extends: true, test: { name: 'isolated', include: ['src/test/isolated/**/*.test.{ts,tsx}'] } }
    ],
    pool: 'threads',
    setupFiles: ['./src/test/setup.ts'],
    css: { include: [/\.css\?raw/] },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      reporter: ['text', 'text-summary', 'html'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 }
    }
  }
});
