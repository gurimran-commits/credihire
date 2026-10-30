import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, MessageSquare, FileText, Image } from 'lucide-react';

export function SubmittedContent({ 
  submittedText, 
  channel = 'whatsapp', 
  timestamp = '2:14 PM',
  attachedFile = null 
}) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isLong = submittedText && submittedText.length > 280;
  const displayText = isLong && !isExpanded ? `${submittedText.slice(0, 280)}...` : submittedText;

  const fallbackCopy = (text) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Fallback copy failed:", e);
    }
  };

  const handleCopy = () => {
    if (!submittedText) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(submittedText)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => fallbackCopy(submittedText));
      } else {
        fallbackCopy(submittedText);
      }
    } catch {
      fallbackCopy(submittedText);
    }
  };

  return (
    <div className="column-submitted">
      <div className="column-header-title">
        <span>Submitted Content</span>
      </div>

      <div className="message-bubble-card">
        {/* Attached Document Banner if evaluated from document/screenshot */}
        {attachedFile && (
          <div className="d-flex align-items-center gap-2 mb-3 p-2 rounded" style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <FileText size={18} className="text-primary flex-shrink-0" />
            <div className="overflow-hidden flex-grow-1">
              <div className="text-white fw-bold text-truncate" style={{ fontSize: '0.84rem' }}>
                {attachedFile.name}
              </div>
              <div className="text-white-50" style={{ fontSize: '0.72rem' }}>
                Uploaded Document • {attachedFile.size || 'Analyzed'}
              </div>
            </div>
            <span className="badge bg-primary bg-opacity-25 text-white" style={{ fontSize: '0.68rem', padding: '3px 7px' }}>
              Extracted & Checked
            </span>
          </div>
        )}

        <div className="d-flex align-items-start gap-3">
          {/* Channel Icon Badge (Green WhatsApp badge matching reference, or Document/Screenshot) */}
          <div className={`channel-icon-badge ${channel === 'whatsapp' ? 'whatsapp' : (channel === 'document' || channel === 'screenshot') ? 'document' : 'generic'}`}>
            {channel === 'whatsapp' ? (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.969.54 1.777.82 2.796.82 3.18 0 5.767-2.586 5.768-5.766 0-3.18-2.587-5.806-5.768-5.806zm3.374 8.243c-.145.407-.743.747-1.026.794-.28.046-.628.077-1.802-.41-1.498-.62-2.455-2.148-2.53-2.247-.074-.1-1.026-1.365-1.026-2.604 0-1.239.645-1.848.874-2.096.229-.248.5-.31.667-.31.168 0 .334.002.48.01.154.008.358-.059.56.425.208.497.708 1.727.771 1.854.062.127.104.276.02.443-.083.167-.125.27-.249.416-.124.145-.262.325-.374.436-.125.124-.255.26-.11.51.146.25.648 1.07 1.39 1.732.955.852 1.76 1.116 2.01 1.24.25.125.395.104.541-.063.146-.166.625-.728.791-.978.167-.25.334-.208.562-.125.23.084 1.458.688 1.708.813.25.125.416.188.479.292.062.104.062.604-.083 1.011z"/>
              </svg>
            ) : channel === 'document' ? (
              <FileText size={18} />
            ) : channel === 'screenshot' ? (
              <Image size={18} />
            ) : (
              <MessageSquare size={17} />
            )}
          </div>

          {/* User message text */}
          <div className="flex-grow-1">
            <div className="message-text-content">
              {displayText}
            </div>

            {/* Read more toggle if text is very long */}
            {isLong && (
              <button
                type="button"
                className="btn btn-link text-primary p-0 mt-2 text-decoration-none d-flex align-items-center gap-1"
                style={{ fontSize: '0.78rem' }}
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <><span>Show less</span><ChevronUp size={14} /></>
                ) : (
                  <><span>Read full text</span><ChevronDown size={14} /></>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Timestamp & copy button on bottom */}
        <div className="message-meta-footer">
          <button
            type="button"
            className="btn btn-sm text-white-50 p-0 border-0 bg-transparent me-auto"
            onClick={handleCopy}
            title="Copy message text"
          >
            {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          </button>
          <span>{timestamp || '2:14 PM'}</span>
        </div>
      </div>
    </div>
  );
}
