'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { GoogleLogin } from '@react-oauth/google';

export default function AuthModal() {
  const { 
    showAuthModal, closeAuthModal, 
    login, signup, verifyOTP, forgotPassword, resetPassword, googleLogin 
  } = useAuth();
  
  // Views: 'auth' (default), 'verify_signup', 'forgot_email', 'forgot_reset'
  const [view, setView] = useState('auth');
  const [isLogin, setIsLogin] = useState(true);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // OTP state
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Real-time validation states
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [usernameMsg, setUsernameMsg] = useState('');
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailMsg, setEmailMsg] = useState('');
  const [passwordStatus, setPasswordStatus] = useState(null);

  // Reset states when modal closes or opens
  useEffect(() => {
    if (showAuthModal) {
      setView('auth');
      setError('');
      setSuccess('');
      setOtp('');
      setNewPassword('');
    }
  }, [showAuthModal]);


  // Real-time username check
  useEffect(() => {
    if (isLogin || view !== 'auth' || !username) {
      setUsernameStatus(null);
      setUsernameMsg('');
      return;
    }

    if (username.length < 3) {
      setUsernameStatus('invalid');
      setUsernameMsg('Minimum 3 characters');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus('invalid');
      setUsernameMsg('Only letters, numbers, and underscores');
      return;
    }

    setUsernameStatus('checking');
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'username', value: username }),
        });
        const data = await res.json();
        if (res.ok) {
          if (data.available) {
            setUsernameStatus('valid');
            setUsernameMsg('Available');
          } else {
            setUsernameStatus('invalid');
            setUsernameMsg('Username is taken');
          }
        } else {
          setUsernameStatus('invalid');
          setUsernameMsg('Error checking availability');
        }
      } catch (err) {
        setUsernameStatus('invalid');
        setUsernameMsg('Error checking availability');
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [username, isLogin, view]);

  // Real-time email check (only on signup)
  useEffect(() => {
    if (!email || view !== 'auth') {
      setEmailStatus(null);
      setEmailMsg('');
      return;
    }

    const isValidFormat = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
    if (!isValidFormat) {
      setEmailStatus('invalid');
      setEmailMsg('Invalid email format');
      return;
    }

    if (isLogin) {
      setEmailStatus('valid');
      setEmailMsg('');
      return;
    }

    setEmailStatus('checking');
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'email', value: email }),
        });
        const data = await res.json();
        if (res.ok) {
          if (data.available) {
            setEmailStatus('valid');
            setEmailMsg('Email available');
          } else {
            setEmailStatus('invalid');
            setEmailMsg('Email already registered');
          }
        } else {
          setEmailStatus('invalid');
          setEmailMsg('Error checking email');
        }
      } catch (err) {
        setEmailStatus('invalid');
        setEmailMsg('Error checking email');
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [email, isLogin, view]);

  // Real-time password check
  useEffect(() => {
    if (!password) {
      setPasswordStatus(null);
      return;
    }
    
    if (password.length >= 6) {
      setPasswordStatus('valid');
    } else {
      setPasswordStatus('invalid');
    }
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (view === 'auth') {
      if (!isLogin && (usernameStatus === 'invalid' || emailStatus === 'invalid' || passwordStatus === 'invalid')) {
        setError('Please fix the errors above before continuing.');
        return;
      }

      setLoading(true);
      try {
        if (isLogin) {
          await login(email, password);
        } else {
          const res = await signup(username, email, password);
          if (res?.requires_verification) {
            setView('verify_signup');
            setSuccess('OTP sent to your email!');
          }
        }
      } catch (err) {
        // If login requires verification, switch view
        if (err.message.includes('verify your email')) {
          setView('verify_signup');
          // Trigger resend
          try {
            await signup(username || 'dummy', email, 'dummy_pass'); // This will resend OTP based on our backend logic
            setSuccess('OTP resent to your email.');
          } catch(e) {}
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    } 
    else if (view === 'verify_signup') {
      setLoading(true);
      try {
        await verifyOTP(email, otp);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    else if (view === 'forgot_email') {
      setLoading(true);
      try {
        await forgotPassword(email);
        setView('forgot_reset');
        setSuccess('If an account exists, a reset OTP was sent.');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    else if (view === 'forgot_reset') {
      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      setLoading(true);
      try {
        await resetPassword(email, otp, newPassword);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setUsername('');
    setPassword('');
    setEmail('');
  };

  const getBorderColor = (status, isFocused) => {
    if (status === 'invalid') return 'var(--accent-red)';
    if (status === 'valid') return 'var(--accent-green)';
    return isFocused ? 'var(--accent-blue)' : 'var(--border-color)';
  };

  const StatusIcon = ({ status }) => {
    if (status === 'checking') return <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', display: 'inline-block' }} />;
    if (status === 'valid') return <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>✓</span>;
    if (status === 'invalid') return <span style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>✕</span>;
    return null;
  };

  if (!showAuthModal) return null;

  return (
    <>
      <div className="modal-overlay" onClick={closeAuthModal} style={{ zIndex: 1000 }} />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        width: '400px',
        maxWidth: '90vw',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: 'var(--space-xl)',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(129, 182, 74, 0.15), rgba(96, 165, 250, 0.15))',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'relative'
        }}>
          {view !== 'auth' && (
            <button 
              onClick={() => { setView('auth'); setError(''); setSuccess(''); }}
              style={{ position: 'absolute', top: 15, left: 15, background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ←
            </button>
          )}
          <div style={{ fontSize: '40px', marginBottom: 'var(--space-sm)' }}>
            {view === 'verify_signup' ? '✉️' : view.startsWith('forgot') ? '🔒' : '♞'}
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
            {view === 'verify_signup' ? 'Verify Email' : 
             view === 'forgot_email' ? 'Reset Password' : 
             view === 'forgot_reset' ? 'Set New Password' :
             (isLogin ? 'Welcome Back!' : 'Join ChessMaster')}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {view === 'verify_signup' ? 'Enter the 6-digit code sent to your email.' : 
             view === 'forgot_email' ? 'Enter your email to receive a reset code.' : 
             view === 'forgot_reset' ? 'Enter the reset code and a new password.' :
             (isLogin ? 'Sign in to play online' : 'Create your account to start playing')}
          </p>
        </div>

        {/* Tabs (only on auth view) */}
        {view === 'auth' && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(''); }}
              style={{
                flex: 1, padding: 'var(--space-md)', background: 'transparent', border: 'none',
                borderBottom: isLogin ? '2px solid var(--accent-green)' : '2px solid transparent',
                color: isLogin ? 'var(--accent-green)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(''); }}
              style={{
                flex: 1, padding: 'var(--space-md)', background: 'transparent', border: 'none',
                borderBottom: !isLogin ? '2px solid var(--accent-blue)' : '2px solid transparent',
                color: !isLogin ? 'var(--accent-blue)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        {view === 'auth' && (
          <div style={{ padding: 'var(--space-xl) var(--space-xl) 0 var(--space-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  try {
                    setError('');
                    setLoading(true);
                    await googleLogin(credentialResponse.credential, isLogin ? 'login' : 'signup');
                  } catch (err) {
                    setError(err.message);
                    setLoading(false);
                  }
                }}
                onError={() => {
                  setError('Google Sign-In failed');
                }}
                theme="filled_black"
                shape="pill"
                text="continue_with"
                width="300"
              />
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', margin: 'var(--space-xl) 0',
              color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px'
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
              <span style={{ padding: '0 var(--space-md)' }}>Or continue with email</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: view === 'auth' ? '0 var(--space-xl) var(--space-xl) var(--space-xl)' : 'var(--space-xl)' }}>
          {view === 'auth' && !isLogin && (
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Username</label>
                <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: usernameStatus === 'valid' ? 'var(--accent-green)' : (usernameStatus === 'invalid' ? 'var(--accent-red)' : 'var(--text-muted)') }}>
                  {usernameMsg} <StatusIcon status={usernameStatus} />
                </div>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. GrandMaster42"
                required
                className="input-field"
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-surface)',
                  border: `1px solid ${getBorderColor(usernameStatus, false)}`,
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                }}
              />
            </div>
          )}

          {(view === 'auth' || view === 'forgot_email') && (
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</label>
                {view === 'auth' && !isLogin && (
                  <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: emailStatus === 'valid' ? 'var(--accent-green)' : (emailStatus === 'invalid' ? 'var(--accent-red)' : 'var(--text-muted)') }}>
                    {emailMsg} <StatusIcon status={emailStatus} />
                  </div>
                )}
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-surface)',
                  border: `1px solid ${view === 'auth' && !isLogin ? getBorderColor(emailStatus, false) : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                }}
              />
            </div>
          )}

          {view === 'auth' && (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
                {isLogin && (
                  <button type="button" onClick={() => setView('forgot_email')} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '12px', cursor: 'pointer' }}>
                    Forgot password?
                  </button>
                )}
                {!isLogin && password && (
                  <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: passwordStatus === 'valid' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {passwordStatus === 'valid' ? 'Good' : 'Min 6 characters'} <StatusIcon status={passwordStatus} />
                  </div>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                minLength={6}
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-surface)',
                  border: `1px solid ${!isLogin ? getBorderColor(passwordStatus, false) : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                }}
              />
            </div>
          )}

          {(view === 'verify_signup' || view === 'forgot_reset') && (
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>6-Digit OTP Code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="000000"
                required
                maxLength={6}
                style={{
                  width: '100%', padding: '12px', background: 'var(--bg-surface)', textAlign: 'center', letterSpacing: '8px',
                  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '24px', outline: 'none'
                }}
              />
            </div>
          )}

          {view === 'forgot_reset' && (
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                required
                minLength={6}
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                }}
              />
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(224, 90, 90, 0.1)', border: '1px solid rgba(224, 90, 90, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--accent-red)', fontSize: '13px', marginBottom: 'var(--space-md)' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: '10px 14px', background: 'rgba(106, 176, 76, 0.1)', border: '1px solid rgba(106, 176, 76, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--accent-green)', fontSize: '13px', marginBottom: 'var(--space-md)' }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (view === 'auth' && !isLogin && (!username || usernameStatus === 'invalid' || emailStatus === 'invalid' || passwordStatus === 'invalid'))}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '12px', fontSize: '15px', fontWeight: 700,
              opacity: (loading || (view === 'auth' && !isLogin && (!username || usernameStatus === 'invalid' || emailStatus === 'invalid' || passwordStatus === 'invalid'))) ? 0.6 : 1,
              cursor: (loading || (view === 'auth' && !isLogin && (!username || usernameStatus === 'invalid' || emailStatus === 'invalid' || passwordStatus === 'invalid'))) ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg, var(--accent-blue), #4a8cdb)',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderTopColor: 'white' }} />
                Processing...
              </span>
            ) : (
              view === 'auth' ? (isLogin ? '🔑 Sign In' : '🚀 Create Account') :
              view === 'verify_signup' ? 'Verify & Login' :
              view === 'forgot_email' ? 'Send Reset OTP' :
              'Reset Password'
            )}
          </button>

          {view === 'auth' && (
            <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)', fontSize: '13px', color: 'var(--text-muted)' }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={switchMode}
                style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', textDecoration: 'underline' }}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          )}
        </form>
      </div>
    </>
  );
}
