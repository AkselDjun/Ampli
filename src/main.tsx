import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import printCss from './styles/print.css?url';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import { Boundary } from './ui/Boundary';
import { LockGate } from './ui/LockGate';
import { initPwa, retirePwa } from './ui/pwa';
import { PWA_ENABLED } from './core/flags';
import { initTheme } from './ui/theme';
import { readLocation } from './app/location';
import { loadCodec } from './ui/linkCodec';
import { installErrorCapture } from './store/errcatch';

installErrorCapture(window);
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
        <LockGate>
          <App />
        </LockGate>
      </Boundary>
    </StrictMode>
  );
};

if (readLocation().link) void loadCodec().then(start, start);
else start();

if (PWA_ENABLED) initPwa(registerSW);
else void retirePwa();
