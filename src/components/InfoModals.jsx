import React from 'react';
import { 
  X, 
  HelpCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Search, 
  Cpu, 
  CheckCircle2, 
  ExternalLink,
  Shield,
  CreditCard,
  MessageCircle,
  Smartphone
} from 'lucide-react';

export function HowItWorksModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-custom">
          <div className="modal-title-wrap">
            <Cpu size={22} className="text-primary" />
            <h2 className="modal-title mb-0">How CrediHire Analyzes Offers</h2>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body-custom d-flex flex-column gap-3">
          <p className="text-secondary" style={{ fontSize: '0.88rem' }}>
            CrediHire combines natural language heuristic pattern matching, conversational syntax analysis, and known employment fraud databases to protect job seekers in real time.
          </p>

          <div className="d-flex flex-column gap-3">
            <div className="p-3 rounded" style={{ background: '#141c2e', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="d-flex align-items-center gap-2 text-white fw-bold mb-1" style={{ fontSize: '0.92rem' }}>
                <span className="badge bg-primary rounded-circle">1</span>
                <span>Syntactic & Keyword Extraction</span>
              </div>
              <p className="text-white-50 mb-0 ps-4" style={{ fontSize: '0.82rem' }}>
                The engine scans for high-risk phrases: registration fees, training charges, Telegram task groups, WhatsApp recruitment links, daily wage promises, and credential harvesting signals.
              </p>
            </div>

            <div className="p-3 rounded" style={{ background: '#141c2e', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="d-flex align-items-center gap-2 text-white fw-bold mb-1" style={{ fontSize: '0.92rem' }}>
                <span className="badge bg-primary rounded-circle">2</span>
                <span>Contextual Risk Scoring (0–100)</span>
              </div>
              <p className="text-white-50 mb-0 ps-4" style={{ fontSize: '0.82rem' }}>
                Risk is classified into High Risk (70–100), Medium Risk (40–69), Low Risk (0–39), or Insufficient Evidence. Rather than generic scores, each score reflects specific identified danger flags.
              </p>
            </div>

            <div className="p-3 rounded" style={{ background: '#141c2e', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="d-flex align-items-center gap-2 text-white fw-bold mb-1" style={{ fontSize: '0.92rem' }}>
                <span className="badge bg-primary rounded-circle">3</span>
                <span>Actionable Defensive Guidance</span>
              </div>
              <p className="text-white-50 mb-0 ps-4" style={{ fontSize: '0.82rem' }}>
                Users receive verified steps to independently confirm the recruiter, plus direct one-click reporting links to the National Cybercrime Portal (cybercrime.gov.in) and Helpline 1930.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScamTypesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const scams = [
    {
      title: "Task-Based Earning & Telegram Scams",
      icon: MessageCircle,
      description: "Recruiters promise ₹2,000–₹8,000 daily for liking videos, rating hotels, or clicking links. Victims are invited to Telegram channels and eventually asked to deposit funds into a 'crypto wallet' to unlock earnings.",
      redFlag: "Any scheme requiring 'recharge' or 'VIP tier deposit' to withdraw earned money."
    },
    {
      title: "Advance Registration & Onboarding Fee Scams",
      icon: CreditCard,
      description: "Fake recruiters claim you are selected for a remote data entry, transcription, or customer support job, but require ₹500–₹2,500 for 'portal login', 'background check', or 'training materials'.",
      redFlag: "Real companies NEVER charge job candidates any onboarding or laptop delivery fee."
    },
    {
      title: "Salary Account OTP & Banking Harvesting",
      icon: Smartphone,
      description: "Fraudsters send fake offer letters bearing stolen corporate logos (Amazon, Flipkart, Google) and claim they need your bank details, debit card CVV, or 6-digit OTP to set up direct deposit.",
      redFlag: "No employer ever requires an OTP or debit card CVV to disburse salary."
    },
    {
      title: "Check / Cheque Overpayment Scams",
      icon: AlertTriangle,
      description: "You receive an upfront check for 'home office setup' and are told to deposit it and wire the excess balance to a specific 'approved vendor'. Days later, the check bounces.",
      redFlag: "Requests to send money back after receiving an unverified check."
    }
  ];

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-custom">
          <div className="modal-title-wrap">
            <AlertTriangle size={22} className="text-warning" />
            <h2 className="modal-title mb-0">Common Job Scam Types</h2>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body-custom d-flex flex-column gap-3">
          {scams.map((scam, idx) => {
            const Icon = scam.icon;
            return (
              <div key={idx} className="p-3 rounded" style={{ background: '#141c2e', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="d-flex align-items-center gap-2 text-white fw-bold mb-1" style={{ fontSize: '0.92rem' }}>
                  <Icon size={16} className="text-warning" />
                  <span>{scam.title}</span>
                </div>
                <p className="text-white-50 mb-2" style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                  {scam.description}
                </p>
                <div className="p-2 rounded text-danger" style={{ background: 'rgba(255,64,88,0.1)', fontSize: '0.78rem' }}>
                  <strong>Key Red Flag:</strong> {scam.redFlag}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SafetyTipsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const tips = [
    "Never pay money to get a job. Legitimate corporations never charge candidates registration, training, or kit fees.",
    "Verify the recruiter on LinkedIn. Check their current tenure and confirm that other company employees connect with them.",
    "Inspect the sender's email domain. Legitimate companies send emails from @company.com, never from free @gmail.com or @outlook.com accounts.",
    "Beware of job offers made without any interview. A formal hiring process always includes at least one structured interview.",
    "Never install screen-sharing software (AnyDesk, TeamViewer) at a recruiter's request.",
    "Never share OTPs, UPI PINs, or net banking passwords with anyone under any circumstances."
  ];

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-custom">
          <div className="modal-title-wrap">
            <ShieldCheck size={22} className="text-success" />
            <h2 className="modal-title mb-0">Job Seeker Safety Checklist</h2>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body-custom d-flex flex-column gap-3">
          <ul className="d-flex flex-column gap-2 ps-3 mb-2" style={{ fontSize: '0.88rem' }}>
            {tips.map((tip, idx) => (
              <li key={idx} className="text-white-50">
                <span className="text-white">{tip}</span>
              </li>
            ))}
          </ul>

          <div className="p-3 rounded mt-2" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <div className="text-white fw-bold mb-1" style={{ fontSize: '0.84rem' }}>
              Suspect Fraud in India?
            </div>
            <div className="text-white-50" style={{ fontSize: '0.78rem' }}>
              Call the National Cyber Crime Helpline at <strong className="text-white">1930</strong> immediately, or lodge an official e-complaint on <a href="https://cybercrime.gov.in/" target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-underline">cybercrime.gov.in</a>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
