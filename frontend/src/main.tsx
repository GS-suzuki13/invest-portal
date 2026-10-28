import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import { getSession } from './utils/api';
import './index.css';

// Limpa qualquer sessão inválida/antiga ANTES de qualquer rota renderizar.
// Evita o loop /login <-> área logada em quem tem estado de um build antigo.
getSession();

// só em desenvolvimento: barra de dados de pior caso (skill break-ui); não entra no build
if (import.meta.env.DEV) {
  void import('./dev/piorCaso').then((m) => m.instalarPiorCaso());
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* "user": com reduzir movimento no sistema, as molas de transform viram corte e só a opacidade anima */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </React.StrictMode>
);
