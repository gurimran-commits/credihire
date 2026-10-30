import React from 'react';
import {
  Globe,
  Lock,
  Unlock,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  ExternalLink,
  Layers,
  CheckCircle2,
  FileQuestion
} from 'lucide-react';

export function UrlCredibilityCard({ result }) {
  if (!result || !result.isUrlAnalysis) return null;

  const {
    targetUrl,
    finalUrl,
    isRedirected,
    redirectChain = [],
    sslInfo,
    riskScore,
    riskLevel,
    reputationStatus,
    summary,
    disclaimer,
    indicators = [],
    recommendationSteps = []
  } = result;

  const getRiskColor = (level) => {
    switch (level) {
      case 'critical':
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#06b6d4';
      default:
        return '#10b981';
    }
  };

  const riskColor = getRiskColor(riskLevel);

  return (
    <div className="url-analysis-card">
      {/* Top Banner: Target URL and Final Destination */}
      <div className="url-header-block">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25 px-2 py-1">
              <Globe size={13} className="me-1" />
              Website Credibility Report
            </span>
            <span
              className="badge px-2 py-1"
              style={{
                backgroundColor: `${riskColor}22`,
                color: riskColor,
                border: `1px solid ${riskColor}44`
              }}
            >
              {riskLevel ? riskLevel.toUpperCase() : 'UNKNOWN'} RISK ({riskScore}/100)
            </span>
          </div>

          <div className="d-flex align-items-center gap-2 text-white-50" style={{ fontSize: '0.78rem' }}>
            <FileQuestion size={13} />
            <span>Reputation: <strong className="text-white">{reputationStatus === 'not_checked' ? 'Not Checked (Heuristic Only)' : reputationStatus}</strong></span>
          </div>
        </div>

        {/* Target and Destination Display */}
        <div className="url-display-box">
          <div className="url-row">
            <span className="url-label text-white-50">Target URL:</span>
            <span className="url-value text-break">{targetUrl}</span>
          </div>

          {isRedirected && (
            <div className="url-row mt-1 pt-1 border-top border-secondary border-opacity-25">
              <span className="url-label text-warning d-flex align-items-center gap-1">
                <ArrowRight size={12} /> Final Destination:
              </span>
              <span className="url-value text-break text-warning fw-medium">{finalUrl}</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary Box */}
      <div className="url-summary-box my-3 p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="mb-0 text-white" style={{ fontSize: '0.92rem' }}>
          <strong>Assessment:</strong> {summary}
        </p>
      </div>

      {/* Key Diagnostic Badges: SSL & Redirects */}
      <div className="row g-3 mb-3">
        {/* SSL / Transport Card */}
        <div className="col-12 col-md-6">
          <div className="diagnostic-subcard p-3 rounded h-100" style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-semibold text-white d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                {sslInfo?.is_valid ? <Lock size={15} className="text-success" /> : <Unlock size={15} className="text-danger" />}
                Transport Encryption (TLS)
              </span>
              <span className={`badge ${sslInfo?.is_valid ? 'bg-success' : 'bg-warning'} bg-opacity-25 ${sslInfo?.is_valid ? 'text-success' : 'text-warning'}`}>
                {sslInfo?.is_valid ? 'Valid Certificate' : (sslInfo?.error ? 'Certificate Alert' : 'Unencrypted HTTP')}
              </span>
            </div>

            {sslInfo?.is_valid ? (
              <div className="text-white-50" style={{ fontSize: '0.78rem' }}>
                <div><strong>Issuer:</strong> {sslInfo.issuer || 'Trusted Certificate Authority'}</div>
                <div><strong>Subject:</strong> {sslInfo.subject || 'Verified Domain'}</div>
                {sslInfo.expires_at && <div><strong>Valid until:</strong> {sslInfo.expires_at}</div>}
              </div>
            ) : (
              <div className="text-white-50" style={{ fontSize: '0.78rem' }}>
                {sslInfo?.error || 'No TLS certificate detected. Communications over plain HTTP can be intercepted or modified.'}
              </div>
            )}
          </div>
        </div>

        {/* Redirect Analysis Card */}
        <div className="col-12 col-md-6">
          <div className="diagnostic-subcard p-3 rounded h-100" style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-semibold text-white d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                <Layers size={15} className="text-primary" />
                Redirect Chain
              </span>
              <span className="badge bg-primary bg-opacity-25 text-primary">
                {redirectChain.length > 0 ? `${redirectChain.length} Hop${redirectChain.length > 1 ? 's' : ''}` : 'Direct Link'}
              </span>
            </div>

            {redirectChain.length > 0 ? (
              <div className="redirect-hops-list" style={{ fontSize: '0.76rem' }}>
                {redirectChain.map((hop, idx) => (
                  <div key={idx} className="d-flex align-items-center gap-1 text-white-50 mb-1 text-truncate">
                    <span className="badge bg-secondary py-0 px-1" style={{ fontSize: '0.68rem' }}>#{hop.hop_number}</span>
                    <span className="badge bg-dark py-0 px-1 text-warning" style={{ fontSize: '0.68rem' }}>{hop.status_code || '30x'}</span>
                    <span className="text-truncate text-white-50" title={hop.url}>{hop.url}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-0 text-white-50" style={{ fontSize: '0.78rem' }}>
                Destination loaded directly without intermediary hops or shortener concealment.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Detected Indicators */}
      <div className="mb-4">
        <h6 className="text-white fw-semibold mb-3 d-flex align-items-center gap-2">
          <ShieldAlert size={16} className="text-warning" />
          Detected Risk Indicators ({indicators.length})
        </h6>

        {indicators.length === 0 ? (
          <div className="p-3 rounded text-success d-flex align-items-center gap-2" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '0.86rem' }}>No deceptive domain patterns, typosquatting, or insecure transport indicators identified.</span>
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {indicators.map((ind, i) => (
              <div
                key={i}
                className="p-3 rounded"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderLeft: `3px solid ${getRiskColor(ind.severity)}`,
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                }}
              >
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                  <span className="fw-semibold text-white" style={{ fontSize: '0.88rem' }}>
                    {ind.code.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-secondary bg-opacity-25 text-white-50" style={{ fontSize: '0.7rem' }}>
                      {ind.category}
                    </span>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: `${getRiskColor(ind.severity)}22`,
                        color: getRiskColor(ind.severity),
                        fontSize: '0.7rem'
                      }}
                    >
                      {ind.severity.toUpperCase()}
                    </span>
                  </div>
                </div>
                <p className="mb-0 text-white-50" style={{ fontSize: '0.82rem' }}>
                  {ind.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Safety Recommendations */}
      {recommendationSteps.length > 0 && (
        <div className="mb-3">
          <h6 className="text-white fw-semibold mb-2 d-flex align-items-center gap-2">
            <ShieldCheck size={16} className="text-success" />
            Safety Recommendations
          </h6>
          <div className="d-flex flex-column gap-2">
            {recommendationSteps.map((rec) => (
              <div
                key={rec.step}
                className="d-flex align-items-start gap-2 p-2 rounded"
                style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.15)' }}
              >
                <span className="badge bg-primary rounded-circle px-2 py-1" style={{ fontSize: '0.72rem' }}>{rec.step}</span>
                <span className="text-white-50" style={{ fontSize: '0.82rem' }}>{rec.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Disclaimer */}
      {disclaimer && (
        <div className="mt-3 pt-2 text-white-50 border-top border-secondary border-opacity-25 d-flex align-items-center gap-2" style={{ fontSize: '0.74rem' }}>
          <Info size={13} className="flex-shrink-0" />
          <span>{disclaimer}</span>
        </div>
      )}
    </div>
  );
}
