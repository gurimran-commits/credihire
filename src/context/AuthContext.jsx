import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_DEMO_DATA } from '../data/demoAnalysis.js';
import { analyzeJobOfferLocally } from '../services/mockAnalysisService.js';

const AuthContext = createContext(null);

const STORAGE_KEY = 'credihire_user_session';
const HISTORY_KEY_PREFIX = 'credihire_history_';

const createDemoHistory = () => {
  const demoResult = (text) => ({
    ...analyzeJobOfferLocally(text),
    isDemo: true,
    sourceNotice: 'Demo reference data — not a live scan.'
  });
  const taskScan = demoResult('Earn ₹5,000 daily by rating YouTube videos. Join our Telegram channel @DailyTasks and deposit ₹2,000 to unlock VIP payouts.');
  const legitScan = demoResult('Dear Alex, We invite you for a 45-minute Google Meet technical interview for the Frontend Engineer position at Acme Corp. No fees or banking info required.');

  return [
    {
      id: 'hist_1',
      date: 'Today, 2:14 PM',
      text: INITIAL_DEMO_DATA.submittedText,
      riskScore: INITIAL_DEMO_DATA.riskScore,
      riskLevel: INITIAL_DEMO_DATA.riskLevel,
      headline: INITIAL_DEMO_DATA.headline,
      summary: INITIAL_DEMO_DATA.summary,
      channel: 'whatsapp',
      warningsCount: INITIAL_DEMO_DATA.warningSigns.length,
      warningTitles: INITIAL_DEMO_DATA.warningSigns.map(w => w.title),
      fullResult: INITIAL_DEMO_DATA
    },
    {
      id: 'hist_2',
      date: 'Yesterday, 11:30 AM',
      text: taskScan.submittedText,
      riskScore: taskScan.riskScore,
      riskLevel: taskScan.riskLevel,
      headline: taskScan.headline,
      summary: taskScan.summary,
      channel: 'telegram',
      warningsCount: taskScan.warningSigns.length,
      warningTitles: taskScan.warningSigns.map(w => w.title),
      fullResult: taskScan
    },
    {
      id: 'hist_3',
      date: 'Oct 26, 4:15 PM',
      text: legitScan.submittedText,
      riskScore: legitScan.riskScore,
      riskLevel: legitScan.riskLevel,
      headline: legitScan.headline,
      summary: legitScan.summary,
      channel: 'email',
      warningsCount: legitScan.warningSigns.length,
      warningTitles: legitScan.warningSigns.map(w => w.title),
      fullResult: legitScan
    }
  ];
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [history, setHistory] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  // Load history whenever user changes
  useEffect(() => {
    if (user && user.id) {
      try {
        const savedHistory = localStorage.getItem(HISTORY_KEY_PREFIX + user.id);
        if (savedHistory) {
          setHistory(JSON.parse(savedHistory));
        } else if (user.email === 'alex.carter@example.com') {
          // Pre-populate demo history for Alex Carter
          const demoHistory = createDemoHistory();
          setHistory(demoHistory);
          localStorage.setItem(HISTORY_KEY_PREFIX + user.id, JSON.stringify(demoHistory));
        } else {
          setHistory([]);
        }
      } catch {
        setHistory([]);
      }
    } else {
      setHistory([]);
    }
  }, [user]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const login = async (email, password) => {
    if (!email || !password) {
      throw new Error("Please enter both email and password.");
    }

    const isDemo = email.toLowerCase() === 'alex.carter@example.com';
    const generatedName = email.split('@')[0]
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Job Seeker';

    const userData = {
      id: isDemo ? 'usr_alex_demo' : 'usr_' + Date.now().toString(36),
      name: isDemo ? 'Alex Carter' : generatedName,
      email: email.toLowerCase(),
      avatarInitials: isDemo ? 'AC' : (generatedName.split(' ').map(n => n[0]).join('') || 'U').slice(0, 2).toUpperCase(),
      plan: 'Verified Job Seeker',
      joinedAt: new Date().toLocaleDateString()
    };

    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    showToast(`Welcome back, ${userData.name}!`);
    return userData;
  };

  const signup = async (name, email, password) => {
    if (!name || !email || !password) {
      throw new Error("Please fill in all required fields.");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    const userData = {
      id: 'usr_' + Date.now().toString(36),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      avatarInitials: (name.trim().split(' ').map(n => n[0]).join('') || 'U').slice(0, 2).toUpperCase(),
      plan: 'New Member Shield',
      joinedAt: new Date().toLocaleDateString()
    };

    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    showToast(`Account created successfully! Welcome, ${userData.name}.`);
    return userData;
  };

  const logout = () => {
    const prevName = user?.name || 'User';
    setUser(null);
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    showToast(`Signed out successfully. See you soon, ${prevName}!`);
  };

  const loginWithDemo = () => {
    return login('alex.carter@example.com', 'password123');
  };

  const addScanToHistory = (scanResult) => {
    if (!user || !user.id || !scanResult) return;

    const newEntry = {
      id: 'hist_' + Date.now().toString(36),
      date: 'Just now',
      text: scanResult.submittedText || '',
      attachedFile: scanResult.attachedFile || null,
      riskScore: scanResult.riskScore || 0,
      riskLevel: scanResult.riskLevel || 'low',
      headline: scanResult.headline || 'Analyzed Offer',
      summary: scanResult.summary || 'Scan completed',
      channel: scanResult.channel || 'generic',
      warningsCount: scanResult.warningSigns?.length || 0,
      warningTitles: scanResult.warningSigns?.map(w => w.title) || [],
      fullResult: scanResult
    };

    setHistory(prev => {
      const updated = [newEntry, ...prev.filter(item => {
        if (newEntry.attachedFile && item.attachedFile) {
          return item.attachedFile.name !== newEntry.attachedFile.name;
        }
        if (newEntry.text && item.text) {
          return item.text !== newEntry.text;
        }
        return item.id !== newEntry.id;
      })];
      try {
        localStorage.setItem(HISTORY_KEY_PREFIX + user.id, JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not save history to localStorage:", e);
      }
      return updated;
    });

    showToast("Scan saved to your History.");
  };

  const deleteHistoryItem = (id) => {
    if (!user || !user.id) return;
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      try {
        localStorage.setItem(HISTORY_KEY_PREFIX + user.id, JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not update history in localStorage:", e);
      }
      return updated;
    });
  };

  const clearHistory = () => {
    if (!user || !user.id) return;
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY_PREFIX + user.id);
    } catch (e) {
      console.warn("Could not clear history:", e);
    }
    showToast("Scan history cleared.");
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      signup, 
      logout, 
      loginWithDemo, 
      toastMessage,
      history,
      addScanToHistory,
      deleteHistoryItem,
      clearHistory
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
