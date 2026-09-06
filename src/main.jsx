import React from 'react';
import { createRoot } from 'react-dom/client';
import './ios-audio-unlock.js';
import App from './App.jsx';
import './styles.css';
import './api-key.css';
import './voice.css';
import './assistant-v2.css';
import './ui-enhancements.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
