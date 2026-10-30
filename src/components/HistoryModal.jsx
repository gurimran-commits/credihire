import React from 'react';
import { 
  X, 
  History, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  MessageSquare,
  Search,
  ExternalLink,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function HistoryModal({ isOpen, onClose, onLoadHistoryItem }) {
  const { user, history, deleteHistoryItem, clearHistory } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog-custom history-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-custom">
          <div className="modal-title-wrap">
            <div className="brand-logo-icon" style={{ width: '32px', height: '32px' }}>
              <History size={18} />
            </div>
            <div>
              <h2 className="modal-title mb-0" style={{ fontSize: '1.2rem' }}>
                Your Scan History
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Review past evaluated job offers and recruiter communications
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-close-modal" 
            onClick={onClose}
            aria-label="Close history modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* History Stats Bar */}
        <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom border-secondary border-opacity-25" style={{ background: 'rgba(10, 15, 29, 0.6)' }}>
          <div className="d-flex align-items-center gap-3">
            <span className="badge bg-primary bg-opacity-25 text-primary px-3 py-2" style={{ fontSize: '0.78rem', borderRadius: '20px' }}>
              Total Scans: {history.length}
            </span>
            <span className="text-white-50" style={{ fontSize: '0.78rem' }}>
              User: <strong className="text-white">{user?.name}</strong>
            </span>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
              style={{ fontSize: '0.75rem', borderRadius: '6px', padding: '3px 8px' }}
              onClick={() => {
                if (window.confirm("Are you sure you want to clear your entire scan history?")) {
                  clearHistory();
                }
              }}
            >
              <Trash2 size={12} />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* History Items List */}
        <div className="modal-body-custom pt-3 d-flex flex-column gap-3">
          {history.length === 0 ? (
            <div className="text-center py-5">
              <History size={42} className="text-white-50 mb-3" opacity={0.4} />
              <h3 className="text-white h6 mb-1">No Scan History Yet</h3>
              <p className="text-white-50 mb-3" style={{ fontSize: '0.84rem' }}>
                Offers and recruiter messages you check while logged in will automatically appear here.
              </p>
              <button
                type="button"
                className="btn btn-sm btn-primary px-3 fw-medium"
                onClick={onClose}
              >
                Scan an Offer Now
              </button>
            </div>
          ) : (
            history.map((item) => {
              const isHighRisk = item.riskLevel === 'high';
              const isLowRisk = item.riskLevel === 'low';

              return (
                <div key={item.id} className="history-card-item">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    {/* Risk Badge */}
                    <div className="d-flex align-items-center gap-2">
                      <span className={`history-risk-badge ${item.riskLevel}`}>
                        {isHighRisk ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                        <span>{item.riskScore}/100 {item.headline}</span>
                      </span>

                      <span className="history-channel-badge text-uppercase">
                        {item.channel}
                      </span>
                    </div>

                    {/* Timestamp & Delete */}
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-white-50 d-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                        <Clock size={11} />
                        <span>{item.date}</span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm text-white-50 p-0 border-0 bg-transparent hover-danger"
                        title="Delete this scan from history"
                        onClick={() => deleteHistoryItem(item.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Attached Document indicator if available */}
                  {item.attachedFile && (
                    <div className="d-flex align-items-center gap-1 mb-2 text-primary" style={{ fontSize: '0.74rem' }}>
                      <FileText size={13} />
                      <span className="fw-semibold text-truncate" style={{ maxWidth: '280px' }}>{item.attachedFile.name}</span>
                      <span className="text-white-50">({item.attachedFile.size})</span>
                    </div>
                  )}

                  {/* Offer Snippet */}
                  <div className="history-text-snippet">
                    "{item.text}"
                  </div>

                  {/* Warning summary tags */}
                  {item.warningTitles && item.warningTitles.length > 0 && (
                    <div className="d-flex flex-wrap gap-1 mt-2 mb-2">
                      {item.warningTitles.map((title, idx) => (
                        <span key={idx} className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25" style={{ fontSize: '0.68rem', fontWeight: 500 }}>
                          • {title}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Load Button */}
                  <div className="d-flex justify-content-end mt-2 pt-2 border-top border-secondary border-opacity-10">
                    <button
                      type="button"
                      className="btn-load-history"
                      onClick={() => onLoadHistoryItem(item)}
                    >
                      <span>Load in Dashboard</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
