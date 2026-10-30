import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Shield, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function AuthModal({ isOpen, onClose, initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login, signup, loginWithDemo } = useAuth();

  // Fix: Synchronize mode with initialMode whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setShowPassword(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        await login(email, password);
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await signup(name, email, password);
      }
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithDemo();
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="modal-dialog-custom auth-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header-custom">
          <div className="modal-title-wrap">
            <div className="brand-logo-icon" style={{ width: '32px', height: '32px' }}>
              <Shield size={18} />
            </div>
            <div>
              <h2 className="modal-title mb-0" style={{ fontSize: '1.2rem' }}>
                {mode === 'signin' ? 'Sign In to CrediHire' : 'Create CrediHire Account'}
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {mode === 'signin' 
                  ? 'Access your saved scam scans and safety history' 
                  : 'Start protecting your job search with verified safety tools'}
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-close-modal" 
            onClick={handleClose}
            aria-label="Close authentication modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Auth Mode Tabs */}
        <div className="auth-tabs-row">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => { setMode('signin'); setError(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(null); }}
          >
            Create Account
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body-custom pt-3">
          {/* Quick Demo One-Click Access (Convenient for Reviewers) */}
          {mode === 'signin' && (
            <div className="demo-auth-box mb-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-white fw-semibold d-flex align-items-center gap-1" style={{ fontSize: '0.8rem' }}>
                  <Sparkles size={13} className="text-warning" />
                  Instant Test Account:
                </span>
                <span className="badge bg-secondary bg-opacity-50 text-white-50" style={{ fontSize: '0.7rem' }}>
                  Hackathon Review
                </span>
              </div>
              <button
                type="button"
                className="btn-demo-quick-login"
                onClick={handleDemoSignIn}
                disabled={loading}
              >
                <span>Sign in as Alex Carter (1-Click Demo)</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* Error Notice */}
          {error && (
            <div className="input-feedback-error mb-3 p-2 rounded" style={{ background: 'rgba(255, 64, 88, 0.1)', border: '1px solid rgba(255, 64, 88, 0.3)' }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            {/* Name Field (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label className="auth-label" htmlFor="auth-name">Full Name</label>
                <div className="auth-input-wrapper">
                  <User size={16} className="auth-input-icon" />
                  <input
                    id="auth-name"
                    type="text"
                    className="auth-input-field"
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="auth-label" htmlFor="auth-email">Email Address</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="auth-email"
                  type="email"
                  className="auth-input-field"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="auth-label mb-0" htmlFor="auth-password">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    className="btn btn-link text-white-50 p-0 text-decoration-none"
                    style={{ fontSize: '0.74rem' }}
                    onClick={() => {
                      setEmail('alex.carter@example.com');
                      setPassword('password123');
                    }}
                  >
                    Fill sample credentials
                  </button>
                )}
              </div>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input-field"
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  className="btn btn-sm text-white-50 p-0 border-0 bg-transparent pe-2"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label className="auth-label" htmlFor="auth-confirm-password">Confirm Password</label>
                <div className="auth-input-wrapper">
                  <CheckCircle2 size={16} className="auth-input-icon" />
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input-field"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-auth-submit mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner-icon" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Switch Tab Footer */}
          <div className="text-center mt-3 pt-2 border-top border-secondary border-opacity-25" style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            {mode === 'signin' ? (
              <span>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  className="btn btn-link text-primary p-0 text-decoration-none fw-semibold"
                  style={{ fontSize: '0.82rem' }}
                  onClick={() => { setMode('signup'); setError(null); }}
                >
                  Create one free
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  className="btn btn-link text-primary p-0 text-decoration-none fw-semibold"
                  style={{ fontSize: '0.82rem' }}
                  onClick={() => { setMode('signin'); setError(null); }}
                >
                  Sign in here
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
