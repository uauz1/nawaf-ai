import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import LivingMascotLayer from './LivingMascotLayer.jsx';
import './styles.css';
import './living-mascot-v2.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <LivingMascotLayer />
  </React.StrictMode>
);
