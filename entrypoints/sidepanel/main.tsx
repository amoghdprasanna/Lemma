import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/src/ui/App';
import '@/src/ui/theme.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Lemma: #root element missing from sidepanel.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
