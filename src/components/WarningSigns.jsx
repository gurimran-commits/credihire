import React from 'react';
import { 
  AlertTriangle, 
  CreditCard, 
  FileText, 
  Link2Off, 
  MessageCircle, 
  Key, 
  Clock, 
  HelpCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

const ICON_MAP = {
  CreditCard,
  FileText,
  Link2Off,
  MessageCircle,
  Key,
  Clock,
  AlertTriangle
};

export function WarningSigns({ warningSigns = [], onSelectWarning }) {
  if (!warningSigns || warningSigns.length === 0) {
    return (
      <div className="warning-signs-section">
        <div className="warning-section-header">
          <AlertTriangle size={17} className="text-muted" />
          <span>Key Warning Signs</span>
        </div>
        <div className="p-3 text-white-50" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '0.84rem' }}>
          No definitive high-risk warning flags were triggered in this offer text. Continue to verify recruiter credentials.
        </div>
      </div>
    );
  }

  return (
    <div className="warning-signs-section">
      <div className="warning-section-header">
        <AlertTriangle size={17} className="text-danger" />
        <span>Key Warning Signs</span>
      </div>

      <div className="warning-signs-list">
        {warningSigns.map((sign) => {
          const IconComp = ICON_MAP[sign.icon] || AlertTriangle;
          return (
            <div
              key={sign.id}
              className="warning-sign-card"
              onClick={() => onSelectWarning && onSelectWarning(sign)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectWarning && onSelectWarning(sign);
                }
              }}
              title="Click to learn why this is a warning sign"
            >
              <div className="warning-icon-box">
                <IconComp size={16} />
              </div>

              <div className="warning-content">
                <div className="warning-title">
                  <span>{sign.title}</span>
                  {sign.externalUrl && (
                    <a
                      href={sign.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white-50 ms-1"
                      onClick={(e) => e.stopPropagation()}
                      title="Learn more on WhatsApp safety guide"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <div className="warning-explanation">
                  {sign.explanation}
                </div>
              </div>

              <div className="text-white-50 align-self-center">
                <ChevronRight size={15} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
