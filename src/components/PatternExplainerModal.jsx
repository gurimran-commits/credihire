import React from 'react';
import { AlertTriangle, X, ShieldAlert, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

export function PatternExplainerModal({ warning, onClose }) {
  if (!warning) return null;

  const explainer = warning.patternExplainer || {
    whatItIs: warning.title,
    whyItMatters: warning.explanation,
    realWorldTactic: "Attackers disguise demands as standard corporate recruitment policies.",
    immediateAction: "Independently contact the company through verified public channels."
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-custom">
          <div className="modal-title-wrap">
            <div className="rounded p-2" style={{ background: 'rgba(255, 64, 88, 0.15)', color: '#ff5c72' }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="badge bg-danger bg-opacity-25 text-danger px-2 py-1 mb-1" style={{ fontSize: '0.7rem' }}>
                SCAM PATTERN EXPLAINER
              </div>
              <h2 className="modal-title mb-0" style={{ fontSize: '1.15rem' }}>{warning.title}</h2>
            </div>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Close explainer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="modal-body-custom d-flex flex-column gap-3">
          {/* Flagged Evidence */}
          {warning.evidence && (
            <div className="p-3 rounded" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div className="text-white-50 text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                Flagged from your submitted text:
              </div>
              <div className="text-white mt-1 fst-italic" style={{ fontSize: '0.88rem' }}>
                "{warning.evidence}"
              </div>
            </div>
          )}

          {/* 1. What This Sign Means */}
          <div>
            <h3 className="text-white fw-bold mb-1 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
              <span className="badge rounded-circle p-1" style={{ background: '#7950F2', color: '#fff', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem' }}>1</span>
              What this warning sign means
            </h3>
            <p className="text-secondary ps-4 mb-0" style={{ fontSize: '0.86rem', lineHeight: '1.5' }}>
              {explainer.whatItIs}
            </p>
          </div>

          {/* 2. Why It Matters */}
          <div>
            <h3 className="text-white fw-bold mb-1 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
              <span className="badge rounded-circle p-1" style={{ background: '#7950F2', color: '#fff', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem' }}>2</span>
              Why this is dangerous
            </h3>
            <p className="text-secondary ps-4 mb-0" style={{ fontSize: '0.86rem', lineHeight: '1.5' }}>
              {explainer.whyItMatters}
            </p>
          </div>

          {/* 3. The Fraudster's Playbook */}
          <div>
            <h3 className="text-white fw-bold mb-1 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
              <span className="badge rounded-circle p-1" style={{ background: '#7950F2', color: '#fff', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem' }}>3</span>
              How scammers execute this tactic
            </h3>
            <p className="text-secondary ps-4 mb-0" style={{ fontSize: '0.86rem', lineHeight: '1.5' }}>
              {explainer.realWorldTactic}
            </p>
          </div>

          {/* 4. Action Recommendation */}
          <div className="p-3 rounded mt-2" style={{ background: 'rgba(36, 209, 139, 0.1)', border: '1px solid rgba(36, 209, 139, 0.3)' }}>
            <div className="text-success fw-bold d-flex align-items-center gap-2 mb-1" style={{ fontSize: '0.88rem' }}>
              <ShieldCheck size={18} />
              <span>Recommended Action Right Now:</span>
            </div>
            <div className="text-white ps-4" style={{ fontSize: '0.84rem' }}>
              {explainer.immediateAction}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-top border-secondary border-opacity-25 d-flex justify-content-end">
          <button
            type="button"
            className="btn btn-sm btn-primary px-4 fw-medium"
            onClick={onClose}
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
