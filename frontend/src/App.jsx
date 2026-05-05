// frontend/src/App.jsx
import React, { useState } from 'react';
import BillingScreen from './components/billing/BillingScreen';
import ProductManager from './components/products/ProductManager';
import BillHistory from './components/billing/BillHistory';
import { ToastProvider } from './context/ToastContext';
export default function App() {
  const [currentScreen, setCurrentScreen] = useState('billing'); // 'billing', 'products', 'history'

  return (
    <>
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
    </>
  );
}