import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Contêiner da aplicação não encontrado.');
const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
// The bootstrap is separate from the component refresh boundary.
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
