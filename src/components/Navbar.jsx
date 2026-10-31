import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  ArrowRight, 
  Menu, 
  X, 
  User, 
  LogOut, 
  ChevronDown, 
  CheckCircle2, 
  Sparkles,
  Search,
  History,
  Puzzle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function Navbar({ 
  onOpenHowItWorks, 
  onOpenScamTypes, 
  onOpenSafetyTips, 
  onOpenHistory,
  onOpenExtensionGuide,
  onFocusInput, 
  onOpenAuth,
  activeSection: controlledActiveSection
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [internalActiveSection, setInternalActiveSection] = useState('home');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const activeSection = controlledActiveSection || internalActiveSection;

  const { user, history, logout } = useAuth();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (section, action) => {
    setInternalActiveSection(section);
    setMobileMenuOpen(false);
    if (action) action();
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setInternalActiveSection('home');
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    logout();
  };

  return (
    <nav className={`navbar-custom ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container d-flex align-items-center justify-content-between">
        {/* Brand Mark */}
        <a href="#home" className="brand-mark" onClick={(e) => { e.preventDefault(); scrollToTop(); }}>
          <div className="brand-logo-icon">
            <Shield size={20} strokeWidth={2.5} />
          </div>
          <div>
            <span className="brand-text-credi">Credi</span>
            <span className="brand-text-hire">Hire</span>
          </div>
        </a>

        {/* Center Desktop Navigation */}
        <div className="nav-links-center d-none d-lg-flex">
          <a
            href="#home"
            className={`nav-link-item ${activeSection === 'home' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); scrollToTop(); }}
          >
            Home
          </a>
          <button
            type="button"
            className={`nav-link-item border-0 bg-transparent ${activeSection === 'how-it-works' ? 'active' : ''}`}
            onClick={() => handleNavClick('how-it-works', onOpenHowItWorks)}
          >
            How It Works
          </button>
          <button
            type="button"
            className={`nav-link-item border-0 bg-transparent ${activeSection === 'scam-types' ? 'active' : ''}`}
            onClick={() => handleNavClick('scam-types', onOpenScamTypes)}
          >
            Scam Types
          </button>
          <button
            type="button"
            className={`nav-link-item border-0 bg-transparent ${activeSection === 'safety-tips' ? 'active' : ''}`}
            onClick={() => handleNavClick('safety-tips', onOpenSafetyTips)}
          >
            Safety Tips
          </button>

          {/* Logged In Only: History Tab */}
          {user && (
            <button
              type="button"
              className={`nav-link-item border-0 bg-transparent d-inline-flex align-items-center gap-1 ${activeSection === 'history' ? 'active' : ''}`}
              onClick={() => handleNavClick('history', onOpenHistory)}
              title="View your saved scam scan history"
            >
              <History size={14} className="text-primary" />
              <span>History</span>
              {history && history.length > 0 && (
                <span className="badge rounded-pill bg-primary bg-opacity-25 text-white" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                  {history.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Right Actions: Auth / Account Option */}
        <div className="nav-actions-right d-flex align-items-center gap-2">
          {/* Get Extension Button (Always visible on desktop) */}
          <button
            type="button"
            className="btn-get-extension d-none d-sm-inline-flex align-items-center gap-2"
            onClick={onOpenExtensionGuide}
            title="Get Credihire Extension for Chrome & Edge"
          >
            <Puzzle size={15} />
            <span>Get Extension</span>
          </button>

          {/* User Logged Out: Show Sign In / Sign Up buttons */}
          {!user ? (
            <div className="d-none d-sm-flex align-items-center gap-2">
              <button
                type="button"
                className="btn-auth-signin"
                onClick={() => onOpenAuth('signin')}
              >
                <span>Sign In</span>
              </button>

              <button
                type="button"
                className="btn-nav-cta"
                onClick={() => onOpenAuth('signup')}
              >
                <span>Sign Up</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            /* User Logged In: Show Account pill with avatar & dropdown */
            <div className="position-relative d-none d-sm-block" ref={dropdownRef}>
              <button
                type="button"
                className="btn-account-pill"
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="true"
              >
                <div className="account-avatar-badge">
                  {user.avatarInitials || 'US'}
                </div>
                <div className="account-info-text text-start">
                  <span className="account-name-text">{user.name}</span>
                </div>
                <ChevronDown size={14} className={`chevron-indicator ${accountMenuOpen ? 'rotate' : ''}`} />
              </button>

              {/* Account Dropdown Menu */}
              {accountMenuOpen && (
                <div className="account-dropdown-card">
                  {/* Account Header */}
                  <div className="p-3 border-bottom border-secondary border-opacity-25">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <div className="account-avatar-badge" style={{ width: '34px', height: '34px', fontSize: '0.85rem' }}>
                        {user.avatarInitials}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-white fw-bold text-truncate" style={{ fontSize: '0.9rem' }}>
                          {user.name}
                        </div>
                        <div className="text-white-50 text-truncate" style={{ fontSize: '0.74rem' }}>
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 d-flex align-items-center gap-1 text-success" style={{ fontSize: '0.74rem' }}>
                      <CheckCircle2 size={13} />
                      <span>{user.plan || 'Verified Job Seeker'}</span>
                    </div>
                  </div>

                  {/* Dropdown Options */}
                  <div className="p-2 d-flex flex-column gap-1">
                    <button
                      type="button"
                      className="account-menu-item"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onFocusInput();
                      }}
                    >
                      <Search size={15} className="text-primary" />
                      <span>Check a Job Offer</span>
                    </button>

                    <button
                      type="button"
                      className="account-menu-item"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenHistory();
                      }}
                    >
                      <History size={15} className="text-warning" />
                      <div className="d-flex justify-content-between align-items-center w-100">
                        <span>Scan History</span>
                        {history && history.length > 0 && (
                          <span className="badge bg-secondary bg-opacity-50 text-white-50" style={{ fontSize: '0.68rem' }}>
                            {history.length}
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="border-top border-secondary border-opacity-25 my-1"></div>

                    <button
                      type="button"
                      className="account-menu-item text-danger hover-danger"
                      onClick={handleLogout}
                    >
                      <LogOut size={15} />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            className="btn-mobile-toggle d-lg-none"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="d-lg-none px-3 pt-3 pb-4" style={{ background: '#0a0e1c', borderBottom: '1px solid rgba(139, 92, 246, 0.3)' }}>
          <div className="d-flex flex-column gap-3">
            {/* If user logged in, show user banner */}
            {user ? (
              <div className="p-3 rounded mb-2" style={{ background: '#141c2e', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <div className="account-avatar-badge">
                      {user.avatarInitials}
                    </div>
                    <div>
                      <div className="text-white fw-bold" style={{ fontSize: '0.88rem' }}>{user.name}</div>
                      <div className="text-white-50" style={{ fontSize: '0.74rem' }}>{user.email}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                    style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                    onClick={handleLogout}
                  >
                    <LogOut size={13} />
                    <span>Logout</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary w-100 d-inline-flex align-items-center justify-content-center gap-1"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => { setMobileMenuOpen(false); onOpenHistory(); }}
                >
                  <History size={13} />
                  <span>View Scan History ({history?.length || 0})</span>
                </button>
              </div>
            ) : (
              /* Mobile Auth Buttons */
              <div className="d-flex gap-2 mb-2">
                <button
                  type="button"
                  className="btn btn-outline-light flex-grow-1"
                  style={{ borderRadius: '20px', fontSize: '0.86rem' }}
                  onClick={() => { setMobileMenuOpen(false); onOpenAuth('signin'); }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="btn-nav-cta justify-content-center flex-grow-1"
                  onClick={() => { setMobileMenuOpen(false); onOpenAuth('signup'); }}
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Mobile Get Extension Button */}
            <button
              type="button"
              className="btn-get-extension-mobile d-flex align-items-center justify-content-center gap-2 py-2 px-3"
              onClick={() => { setMobileMenuOpen(false); if (onOpenExtensionGuide) onOpenExtensionGuide(); }}
            >
              <Puzzle size={16} />
              <span>Get Browser Extension</span>
            </button>

            <a
              href="#home"

              className="text-white py-2 px-2 text-decoration-none fw-semibold"
              onClick={(e) => { e.preventDefault(); scrollToTop(); }}
            >
              Home
            </a>
            <button
              type="button"
              className="text-start text-white-50 py-2 px-2 border-0 bg-transparent fw-medium"
              onClick={() => handleNavClick('how-it-works', onOpenHowItWorks)}
            >
              How It Works
            </button>
            <button
              type="button"
              className="text-start text-white-50 py-2 px-2 border-0 bg-transparent fw-medium"
              onClick={() => handleNavClick('scam-types', onOpenScamTypes)}
            >
              Scam Types
            </button>
            <button
              type="button"
              className="text-start text-white-50 py-2 px-2 border-0 bg-transparent fw-medium"
              onClick={() => handleNavClick('safety-tips', onOpenSafetyTips)}
            >
              Safety Tips
            </button>
            <button
              type="button"
              className="btn-nav-cta justify-content-center mt-2"
              onClick={() => { setMobileMenuOpen(false); onFocusInput(); }}
            >
              <Search size={15} />
              <span>Check a Job Offer</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
