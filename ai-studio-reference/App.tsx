import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { AuthView } from './components/AuthView';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate checking for existing session
    const timer = setTimeout(() => {
      const savedAuth = localStorage.getItem('lc_authenticated');
      if (savedAuth === 'true') {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setShowAuth(false);
    localStorage.setItem('lc_authenticated', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('lc_authenticated');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Dashboard onLogout={handleLogout} />;
  }

  if (showAuth) {
    return <AuthView onLogin={handleLogin} />;
  }

  return <LandingPage onStart={() => setShowAuth(true)} />;
}
