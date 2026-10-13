import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

console.log('main.tsx: Starting React app...');
const rootEl = document.getElementById('root');
console.log('main.tsx: root element:', rootEl);

if (!rootEl) {
  console.error('main.tsx: #root element not found!');
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('main.tsx: React rendered');
}