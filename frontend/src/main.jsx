import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Filtrar mensajes de SES/lockdown de la consola (provenientes de extensiones del navegador)
if (typeof console !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    // Filtrar mensajes relacionados con SES/lockdown
    if (
      message.includes('SES Removing') ||
      message.includes('Removing intrinsics') ||
      message.includes('lockdown-install.js')
    ) {
      return; // No mostrar estos mensajes
    }
    originalError.apply(console, args);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

