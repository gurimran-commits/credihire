import React, { useState } from 'react';
import { 
  LifeBuoy, 
  X, 
  Phone, 
  ExternalLink, 
  AlertOctagon, 
  Key, 
  FileCheck, 
  Smartphone, 
  Copy, 
  Check, 
  ShieldAlert
} from 'lucide-react';

export function RecoveryGuide({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('money');
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  if (!isOpen) return null;

  const incidentTemplate = `INCIDENT REPORT DETAILS FOR 1930 / CYBERCRIME PORTAL:
- Date & Time of Incident: ${new Date().toLocaleDateString()}
- Platform Used: WhatsApp / Telegram / SMS
- Suspected Fraudster Contact / Handle: [Enter Number/Username]
- Bank Account / UPI ID Transferred To: [Enter Fraudster Account/UPI]
- Transaction Reference Number (UTR / Ref ID): [Enter UTR]
- Amount Debited: ₹[Enter Amount]
- Summary of Fraud: Recruiter promised a remote job / task-based earning and demanded an upfront registration/deposit fee.`;

  const copyTemplate = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(incidentTemplate).then(() => {
          setCopiedTemplate(true);
          setTimeout(() => setCopiedTemplate(false), 2500);
        }).catch(() => fallbackCopy());
      } else {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
  };

  const fallbackCopy = () => {
    const textarea = document.createElement('textarea');
    textarea.value = incidentTemplate;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2500);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
    document.body.removeChild(textarea);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog-custom recovery-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-custom">
          <div className="modal-title-wrap">
            <div style={{ color: '#ff5c72' }}>
              <LifeBuoy size={24} />
            </div>
            <div>
              <h2 className="modal-title mb-0">Emergency Fraud Recovery Guide</h2>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Immediate action steps if you have already interacted with or paid a fraudulent recruiter
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Close recovery guide"
          >
            <X size={20} />
          </button>
        </div>

        {/* Helpline Banner */}
        <div className="p-3 mx-4 mt-3 rounded d-flex flex-wrap align-items-center justify-content-between gap-3"
          style={{ background: 'rgba(255, 64, 88, 0.12)', border: '1px solid rgba(255, 64, 88, 0.35)' }}>
          <div className="d-flex align-items-center gap-3">
            <div className="rounded-circle p-2" style={{ background: '#FF4058', color: '#fff' }}>
              <Phone size={20} />
            </div>
            <div>
              <div className="text-white fw-bold" style={{ fontSize: '0.95rem' }}>
                National Cyber Crime Helpline: 1930
              </div>
              <div style={{ fontSize: '0.78rem', color: '#ff94a2' }}>
                Toll-free 24/7 across India. Call immediately within the 'Golden Hour' to stop fund movement.
              </div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <a
              href="tel:1930"
              className="btn btn-sm btn-danger px-3 fw-bold d-inline-flex align-items-center gap-1"
            >
              <Phone size={14} />
              <span>Call 1930</span>
            </a>
            <a
              href="https://cybercrime.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-outline-light px-3 fw-medium d-inline-flex align-items-center gap-1"
            >
              <span>Portal</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Tab Selector - Clean Segmented Grid Layout (No horizontal scrollbar cutting through buttons) */}
        <div className="recovery-tabs-segmented-wrapper px-4 pt-3">
          <div className="recovery-tabs-segmented-grid">
            <button
              type="button"
              className={`recovery-segment-btn ${activeTab === 'money' ? 'active' : ''}`}
              onClick={() => setActiveTab('money')}
            >
              <AlertOctagon size={14} />
              <span>1. Money / UPI</span>
            </button>
            <button
              type="button"
              className={`recovery-segment-btn ${activeTab === 'credentials' ? 'active' : ''}`}
              onClick={() => setActiveTab('credentials')}
            >
              <Key size={14} />
              <span>2. OTP / Passwords</span>
            </button>
            <button
              type="button"
              className={`recovery-segment-btn ${activeTab === 'identity' ? 'active' : ''}`}
              onClick={() => setActiveTab('identity')}
            >
              <FileCheck size={14} />
              <span>3. Aadhaar / PAN</span>
            </button>
            <button
              type="button"
              className={`recovery-segment-btn ${activeTab === 'device' ? 'active' : ''}`}
              onClick={() => setActiveTab('device')}
            >
              <Smartphone size={14} />
              <span>4. App / Remote</span>
            </button>
          </div>
        </div>

        {/* Modal Body with Action Checklists */}
        <div className="modal-body-custom pt-3">
          {activeTab === 'money' && (
            <div className="d-flex flex-column gap-3">
              <h3 className="text-white h6 mb-1">Actions to take immediately after making a payment:</h3>
              <ol className="d-flex flex-column gap-2 ps-3 mb-2" style={{ fontSize: '0.86rem' }}>
                <li>
                  <strong className="text-white">Call your bank's fraud reporting desk immediately:</strong> Request a freeze or stop-payment on the transaction reference (UTR number).
                </li>
                <li>
                  <strong className="text-white">Dial 1930 within the 'Golden Hour':</strong> Indian law enforcement uses the Citizen Financial Cyber Fraud Reporting and Management System (CFCFRMS) to freeze scammer merchant accounts before they cash out.
                </li>
                <li>
                  <strong className="text-white">File an online cybercrime complaint:</strong> Submit screenshots, beneficiary UPI handles, chat logs, and bank statements to{' '}
                  <a href="https://cybercrime.gov.in/" target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-underline">
                    cybercrime.gov.in
                  </a>.
                </li>
                <li>
                  <strong className="text-white">Beware of secondary recovery scams:</strong> Fraudsters frequently pose as "ethical hackers" or "recovery lawyers" in the comment sections claiming they can hack back your funds for a fee. Real recovery is only handled by verified law enforcement.
                </li>
              </ol>
            </div>
          )}

          {activeTab === 'credentials' && (
            <div className="d-flex flex-column gap-3">
              <h3 className="text-white h6 mb-1">Actions if you shared an OTP, PIN, or password:</h3>
              <ol className="d-flex flex-column gap-2 ps-3 mb-2" style={{ fontSize: '0.86rem' }}>
                <li>
                  <strong className="text-white">Block debit/credit cards and net banking instantly:</strong> Use your bank's mobile banking app or customer service hotline to temporarily freeze all outgoing transactions.
                </li>
                <li>
                  <strong className="text-white">Change your email and primary account passwords:</strong> If you used the same password elsewhere, update it immediately and activate multi-factor authentication (MFA) with an authenticator app.
                </li>
                <li>
                  <strong className="text-white">Terminate active login sessions:</strong> Log into Google, Apple, and WhatsApp settings and select "Log out of all other devices / active sessions".
                </li>
              </ol>
            </div>
          )}

          {activeTab === 'identity' && (
            <div className="d-flex flex-column gap-3">
              <h3 className="text-white h6 mb-1">Actions if you sent Aadhaar, PAN, or Passport copies:</h3>
              <ol className="d-flex flex-column gap-2 ps-3 mb-2" style={{ fontSize: '0.86rem' }}>
                <li>
                  <strong className="text-white">Lock your Aadhaar biometrics:</strong> Use the official UIDAI portal or mAadhaar app to lock your Aadhaar biometrics to prevent unauthorized SIM issuance or loans.
                </li>
                <li>
                  <strong className="text-white">Check active mobile connections in your name:</strong> Visit the official DoT portal{' '}
                  <a href="https://tafcop.dgtelecom.gov.in/" target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-underline">
                    TAFCOP (tafcop.dgtelecom.gov.in)
                  </a>{' '}
                  to check and report any unauthorized mobile numbers registered with your identity.
                </li>
                <li>
                  <strong className="text-white">Monitor your credit report:</strong> Check CIBIL / Experian reports monthly to ensure no fraudulent loans or BNPL accounts are opened.
                </li>
              </ol>
            </div>
          )}

          {activeTab === 'device' && (
            <div className="d-flex flex-column gap-3">
              <h3 className="text-white h6 mb-1">Actions if you installed an APK, AnyDesk, or TeamViewer:</h3>
              <ol className="d-flex flex-column gap-2 ps-3 mb-2" style={{ fontSize: '0.86rem' }}>
                <li>
                  <strong className="text-white">Turn on Airplane Mode immediately:</strong> Disconnecting from Wi-Fi and mobile data cuts off the remote attacker's live access to your screen and SMS.
                </li>
                <li>
                  <strong className="text-white">Uninstall the downloaded app or APK:</strong> Go to Settings &gt; Apps, locate the unknown application, revoke all permissions, and uninstall it.
                </li>
                <li>
                  <strong className="text-white">Perform a factory reset:</strong> Malicious APKs often install stealth background spyware. Backup essential photos and factory reset the device.
                </li>
              </ol>
            </div>
          )}

          {/* Copyable Incident Summary Template */}
          <div className="mt-4 p-3 rounded" style={{ background: '#141c2e', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-white fw-semibold" style={{ fontSize: '0.82rem' }}>
                Pre-filled Complaint Draft for Police & 1930
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1"
                style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                onClick={copyTemplate}
              >
                {copiedTemplate ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                <span>{copiedTemplate ? 'Copied' : 'Copy Template'}</span>
              </button>
            </div>
            <pre style={{ fontSize: '0.76rem', color: '#94a3b8', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {incidentTemplate}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
