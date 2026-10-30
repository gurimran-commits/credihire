import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { JobOfferForm } from './components/JobOfferForm';
import { TrustIndicators } from './components/TrustIndicators';
import { ResultsPanel } from './components/ResultsPanel';
import { Footer } from './components/Footer';
import { RecoveryGuide } from './components/RecoveryGuide';
import { PatternExplainerModal } from './components/PatternExplainerModal';
import { HowItWorksModal, ScamTypesModal, SafetyTipsModal } from './components/InfoModals';
import { AuthModal } from './components/AuthModal';
import { HistoryModal } from './components/HistoryModal';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useAnalysis } from './hooks/useAnalysis';
import { Sparkles } from 'lucide-react';

function AppContent() {
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState(null);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isScamTypesOpen, setIsScamTypesOpen] = useState(false);
  const [isSafetyTipsOpen, setIsSafetyTipsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { user, toastMessage, addScanToHistory } = useAuth();

  const {
    result,
    setResult,
    inputText,
    setInputText,
    attachedFile,
    setAttachedFile,
    isLoading,
    error,
    analyze,
    loadPreset,
    resetToDemo,
    clearInput
  } = useAnalysis();

  // Close all open modals
  const closeAllModals = useCallback(() => {
    setIsRecoveryOpen(false);
    setSelectedWarning(null);
    setIsHowItWorksOpen(false);
    setIsScamTypesOpen(false);
    setIsSafetyTipsOpen(false);
    setIsAuthOpen(false);
    setIsHistoryOpen(false);
  }, []);

  // Keyboard accessibility: ESC key closes all modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeAllModals();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeAllModals]);

  // Lock body scroll when any modal is open
  const isAnyModalOpen = isRecoveryOpen || !!selectedWarning || isHowItWorksOpen || isScamTypesOpen || isSafetyTipsOpen || isAuthOpen || isHistoryOpen;
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAnyModalOpen]);

  const focusInputArea = () => {
    const el = document.getElementById('job-offer-input');
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleOpenAuth = (mode = 'signin') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  };

  // Perform analysis and auto-save to user history if logged in
  const handleAnalyze = async (overrideData) => {
    const text = overrideData?.text !== undefined ? overrideData.text : inputText;
    const file = overrideData?.file !== undefined ? overrideData.file : attachedFile;
    const scanData = await analyze(text, file);
    if (scanData && user) {
      addScanToHistory(scanData);
    }
  };

  const handleLoadPreset = async (preset) => {
    setAttachedFile(null);
    const scanData = await loadPreset(preset);
    if (scanData && user) {
      addScanToHistory(scanData);
    }
  };

  // Load a scan item from history back into the dashboard
  const handleLoadHistoryItem = (item) => {
    setInputText(item.text);
    if (item.attachedFile) {
      setAttachedFile(item.attachedFile);
    } else {
      setAttachedFile(null);
    }
    if (item.fullResult) {
      setResult(item.fullResult);
    } else {
      analyze(item.text, item.attachedFile);
    }
    setIsHistoryOpen(false);
    const resultsEl = document.getElementById('results-section');
    if (resultsEl) {
      resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Trigger file upload from Hero floating badge
  const triggerHeroFileUpload = () => {
    focusInputArea();
    const fileInput = document.getElementById('offer-file-upload-input') || document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.click();
    }
  };

  return (
    <div className="app-container">
      {/* Mountain Terrain Atmosphere Silhouettes (Reference Image Visuals) */}
      <div className="terrain-backdrop" aria-hidden="true">
        <div className="mountain-left"></div>
        <div className="mountain-right"></div>
        {/* SVG Jagged Mountain Ridges on Sides */}
        <svg
          className="mountain-ridge-svg"
          viewBox="0 0 1440 380"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {/* Left Dark Mountain Ridge */}
          <path
            d="M-50 380L-50 210L60 160L140 220L210 140L290 200L380 270L460 380H-50Z"
            fill="#060914"
            stroke="rgba(139, 92, 246, 0.45)"
            strokeWidth="1.5"
          />
          <path
            d="M-30 380L40 180L110 240L190 170L270 230L340 380H-30Z"
            fill="#080d1c"
            stroke="rgba(121, 80, 242, 0.25)"
            strokeWidth="1"
          />
          {/* Right Dark Mountain Ridge */}
          <path
            d="M1490 380L1490 200L1380 150L1300 210L1220 130L1150 190L1060 260L980 380H1490Z"
            fill="#060914"
            stroke="rgba(57, 119, 255, 0.45)"
            strokeWidth="1.5"
          />
          <path
            d="M1470 380L1400 170L1330 230L1250 160L1170 220L1100 380H1470Z"
            fill="#080d1c"
            stroke="rgba(57, 119, 255, 0.25)"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Navigation Bar with Sign In / Sign Up / Account / History Option */}
      <Navbar
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        onOpenScamTypes={() => setIsScamTypesOpen(true)}
        onOpenSafetyTips={() => setIsSafetyTipsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onFocusInput={focusInputArea}
        onOpenAuth={handleOpenAuth}
        activeSection={
          isHistoryOpen ? 'history'
          : isHowItWorksOpen ? 'how-it-works'
          : isScamTypesOpen ? 'scam-types'
          : isSafetyTipsOpen ? 'safety-tips'
          : 'home'
        }
      />

      <main className="flex-grow-1">
        {/* Hero Section with clickable file badge */}
        <HeroSection onUploadClick={triggerHeroFileUpload} />

        {/* Job Offer Input Form with clickable file icon trigger */}
        <div className="container">
          <JobOfferForm
            inputText={inputText}
            setInputText={setInputText}
            attachedFile={attachedFile}
            setAttachedFile={setAttachedFile}
            onSubmit={handleAnalyze}
            isLoading={isLoading}
            error={error}
            onClear={clearInput}
            onLoadPreset={handleLoadPreset}
          />

          {/* Privacy & Trust Indicators */}
          <TrustIndicators />
        </div>

        {/* Analysis Results Panel */}
        <ResultsPanel
          result={result}
          onResetToDemo={resetToDemo}
          onOpenRecoveryGuide={() => setIsRecoveryOpen(true)}
          onSelectWarning={(warning) => setSelectedWarning(warning)}
        />
      </main>

      {/* Footer & Disclaimer */}
      <Footer />

      {/* Interactive Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={() => setIsAuthOpen(false)}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onLoadHistoryItem={handleLoadHistoryItem}
      />

      <RecoveryGuide
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
      />

      <PatternExplainerModal
        warning={selectedWarning}
        onClose={() => setSelectedWarning(null)}
      />

      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />

      <ScamTypesModal
        isOpen={isScamTypesOpen}
        onClose={() => setIsScamTypesOpen(false)}
      />

      <SafetyTipsModal
        isOpen={isSafetyTipsOpen}
        onClose={() => setIsSafetyTipsOpen(false)}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="auth-toast-banner" role="status">
          <Sparkles size={16} className="text-warning" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
