// frontend/src/components/auth/LoginScreen.jsx
import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';

const API_BASE = '/api';

export default function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { showError } = useToast();

  useEffect(() => {
    // Check if already logged in
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/session`);
      const data = await res.json();
      if (data.authenticated) {
        onLogin();
      }
    } catch (err) {
      // Ignore session check errors
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (data.success) {
        onLogin();
      } else {
        setError(data.message || 'Invalid PIN');
        setPin('');
      }
    } catch (err) {
      showError('Connection error. Please try again.');
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(value);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-white rounded-3xl shadow-2xl mx-auto flex items-center justify-center mb-4">
            <span className="text-5xl">🏪</span>
          </div>
          <h1 className="text-4xl font-bold text-white">MS Store</h1>
          <p className="text-purple-200 mt-2">Billing System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">
            Enter PIN to Access
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <input
                type="password"
                inputMode="numeric"
                placeholder="Enter PIN"
                value={pin}
                onChange={handlePinChange}
                className={`w-full text-center text-3xl tracking-widest px-4 py-4 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  error ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
                autoFocus
                disabled={isLoading}
              />
              {error && (
                <p className="text-red-500 text-sm text-center mt-2">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pin.length < 4 || isLoading}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                pin.length >= 4 && !isLoading
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg transform hover:scale-[1.02]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verifying...
                </span>
              ) : (
                'Unlock'
              )}
            </button>
          </form>

          <p className="text-gray-400 text-sm text-center mt-6">
            Enter your 4-digit PIN to access the billing system
          </p>
        </div>

        <p className="text-purple-300 text-center text-sm mt-6">
          MS Store Billing • Secure Access
        </p>
      </div>
    </div>
  );
}
