import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import { initPwa } from './ui/pwa';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

initPwa(registerSW);
