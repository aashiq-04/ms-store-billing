// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import BillingScreen from './components/billing/BillingScreen';
import ProductManager from './components/products/ProductManager';
import BillHistory from './components/billing/BillHistory';
import LoginScreen from './components/auth/LoginScreen';
import { ToastProvider } from './context/ToastContext';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('billing');

  useEffect(() => {
    fetch('/api/session')
      .then(res => res.json())
      .then(data => {
        setIsAuthenticated(data.authenticated === true);
      })
      .catch(() => {})
      .finally(() => {
        setIsCheckingSession(false);
      });
  }, []);

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <LoginScreen onLogin={() => setIsAuthenticated(true)} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      {currentScreen === 'billing' ? (
        <BillingScreen
          onOpenProducts={() => setCurrentScreen('products')}
          onOpenHistory={() => setCurrentScreen('history')}
        />
      ) : currentScreen === 'products' ? (
        <ProductManager onClose={() => setCurrentScreen('billing')} />
      ) : (
        <BillHistory onClose={() => setCurrentScreen('billing')} />
      )}
    </ToastProvider>
  );
}
