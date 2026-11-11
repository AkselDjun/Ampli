import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import printCss from './styles/print.css?url';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import { Boundary } from './ui/Boundary';
import { initPwa, retirePwa } from './ui/pwa';
import { PWA_ENABLED } from './core/flags';
import { initTheme } from './ui/theme';
import { hasLink } from './core/links';
import { loadCodec } from './ui/linkCodec';

initTheme();

const print = document.createElement('link');
print.rel = 'stylesheet';
print.media = 'print';
print.href = printCss;
document.head.append(print);

const start = (): void => {
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <Boundary>
        <App />
      </Boundary>
    </StrictMode>
  );
};

if (hasLink(window.location.hash)) void loadCodec().then(start, start);
else start();

if (PWA_ENABLED) initPwa(registerSW);
else void retirePwa();
