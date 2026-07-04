'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getSocket, disconnectSocket } from '../lib/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [globalChallenge, setGlobalChallenge] = useState(null); // incoming challenge from any page
  const globalSocketRef = useRef(null);

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('chess_token');
    if (savedToken) {
      setToken(savedToken);
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUser(data.user);
          } else {
            localStorage.removeItem('chess_token');
            setToken(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('chess_token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Global socket: register all authenticated users so they are discoverable on the network
  useEffect(() => {
    if (user && !globalSocketRef.current) {
      const socket = getSocket();
      globalSocketRef.current = socket;
      socket.emit('auth', { userId: user.id, username: user.username, rating: user.rating });

      // Listen for incoming challenges even if user is NOT on the Play Online page
      socket.on('incoming-challenge', (data) => {
        setGlobalChallenge(data.challenger);
      });

      socket.on('incoming-map-challenge', (data) => {
        setGlobalChallenge(data.challenger);
      });
    }

    return () => {
      // Don't disconnect on cleanup — the PlayOnline component manages the socket lifecycle
    };
  }, [user]);

  const dismissGlobalChallenge = useCallback(() => {
    setGlobalChallenge(null);
  }, []);

  const acceptGlobalChallenge = useCallback(() => {
    const socket = globalSocketRef.current;
    if (socket && globalChallenge) {
      socket.emit('accept-nearby-challenge', { challengerSocketId: globalChallenge.socketId });
      setGlobalChallenge(null);
    }
  }, [globalChallenge]);

  const declineGlobalChallenge = useCallback(() => {
    const socket = globalSocketRef.current;
    if (socket && globalChallenge) {
      socket.emit('decline-nearby-challenge', { challengerSocketId: globalChallenge.socketId });
      setGlobalChallenge(null);
    }
  }, [globalChallenge]);

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('chess_token', data.token);
    setShowAuthModal(false);
    return data.user;
  }, []);

  const signup = useCallback(async (username, email, password) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    
    if (data.requires_verification) {
      return { requires_verification: true };
    }
    
    // Fallback if verification is disabled later
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('chess_token', data.token);
    setShowAuthModal(false);
    return data.user;
  }, []);

  const verifyOTP = useCallback(async (email, otp) => {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('chess_token', data.token);
    setShowAuthModal(false);
    return data.user;
  }, []);

  const forgotPassword = useCallback(async (email) => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.message;
  }, []);

  const resetPassword = useCallback(async (email, otp, newPassword) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('chess_token', data.token);
    setShowAuthModal(false);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('chess_token');
    if (globalSocketRef.current) {
      disconnectSocket();
      globalSocketRef.current = null;
    }
  }, []);

  const googleLogin = useCallback(async (credential, mode = 'login') => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, mode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('chess_token', data.token);
    setShowAuthModal(false);
    return data.user;
  }, []);

  const openAuthModal = useCallback(() => setShowAuthModal(true), []);
  const closeAuthModal = useCallback(() => setShowAuthModal(false), []);

  return (
    <AuthContext.Provider value={{
      user, setUser, token, loading,
      login, signup, logout, googleLogin,
      verifyOTP, forgotPassword, resetPassword,
      showAuthModal, openAuthModal, closeAuthModal,
      globalChallenge, acceptGlobalChallenge, declineGlobalChallenge, dismissGlobalChallenge,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
