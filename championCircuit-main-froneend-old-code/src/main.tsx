import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={
        <div style={{ color: '#e8edf7', padding: 40, textAlign: 'center', fontFamily: 'system-ui' }}>
          <h2>Something went wrong</h2>
          <p>Please refresh the page.</p>
        </div>
      }
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
