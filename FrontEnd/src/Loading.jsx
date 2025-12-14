import React from 'react';
import './loading.css';
import logo from './assets/renardologo.png';

export default function Loading({ label = 'Chargement...' }) {
  return (
    <div className="loading-container">
      <img src={logo} alt="Logo" className="loading-logo" />
      <div className="loading-text">{label}</div>
    </div>
  );
}