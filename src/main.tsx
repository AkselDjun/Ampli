import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import { Boundary } from './ui/Boundary';
import { initPwa, retirePwa } from './ui/pwa';
import { PWA_ENABLED } from './core/flags';
import { initTheme } from './ui/theme';

initTheme();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>
);

if (PWA_ENABLED) initPwa(registerSW);
else void retirePwa();
