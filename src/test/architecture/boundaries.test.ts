import { describe, expect, it } from 'vitest';

const coreModules = import.meta.glob<string>('../../core/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
const storeModules = import.meta.glob<string>('../../store/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
const onboardingModel = import.meta.glob<string>('../../features/onboarding/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });

const importsFrom = (source: string): string[] => [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match => match[1]);

describe('architecture boundaries', () => {
  it('keeps the calculation core independent from app, store and UI layers', () => {
    for (const [file, source] of Object.entries(coreModules)) {
      const forbidden = importsFrom(source).filter(path => path.includes('/app/') || path.includes('/store/') || path.includes('/ui/'));
      expect(forbidden, file).toEqual([]);
    }
  });

  it('keeps persistence and reducers independent from app and UI layers', () => {
    for (const [file, source] of Object.entries(storeModules)) {
      const forbidden = importsFrom(source).filter(path => path.includes('/app/') || path.includes('/ui/'));
      expect(forbidden, file).toEqual([]);
    }
  });

  it('keeps onboarding model and storage independent from React UI', () => {
    for (const [file, source] of Object.entries(onboardingModel)) {
      const forbidden = importsFrom(source).filter(path => path.includes('/app/') || path.includes('/ui/') || path === 'react');
      expect(forbidden, file).toEqual([]);
    }
  });

  it('loads the onboarding screen only when it is needed', () => {
    const app = import.meta.glob<string>('../../ui/App.tsx', { query: '?raw', import: 'default', eager: true })['../../ui/App.tsx'];
    const runtime = [...app.matchAll(/^import\s+(?!type\b)[^;]*from\s+['"]([^'"]+)['"]/gm)].map(m => m[1]);
    expect(runtime).not.toContain('./Onboarding');
    const parts = import.meta.glob<string>('../../ui/parts.tsx', { query: '?raw', import: 'default', eager: true })['../../ui/parts.tsx'];
    expect(parts).toMatch(/import\('\.\/Onboarding'\)/);
  });

  it('keeps the texts of the tour out of the first screen', () => {
    const eager = import.meta.glob<string>(['../../ui/App.tsx', '../../app/*.{ts,tsx}', '../../features/onboarding/{model,storage,placement}.ts'], { query: '?raw', import: 'default', eager: true });
    for (const [file, source] of Object.entries(eager)) expect(importsFrom(source).filter(path => path.endsWith('/steps') || path.endsWith('onboarding/steps')), file).toEqual([]);
    const onboarding = import.meta.glob<string>('../../ui/Onboarding.tsx', { query: '?raw', import: 'default', eager: true })['../../ui/Onboarding.tsx'];
    expect(importsFrom(onboarding)).toContain('../features/onboarding/steps');
  });
});
