import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import TripExportPreview from './components/TripExportPreview.jsx';
import './index.css';

const RootComponent = window.location.pathname === '/export-preview' ? TripExportPreview : App;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
);
