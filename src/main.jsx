import React from 'react';
import { createRoot } from 'react-dom/client';
import './ios-audio-unlock.js';
import './smart-options.js';
import App from './App.jsx';
import './styles.css';
import './smart-options.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
