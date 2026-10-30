import React from 'react';
import { LifeBuoy, ArrowRight, RotateCcw, Copy, Check, Sparkles, Globe } from 'lucide-react';
import { SubmittedContent } from './SubmittedContent';
import { RiskScoreCard } from './RiskScoreCard';
import { WarningSigns } from './WarningSigns';
import { RecommendedActions } from './RecommendedActions';
import { UrlCredibilityCard } from './UrlCredibilityCard';

export function ResultsPanel({
  result,
  onResetToDemo,
  onOpenRecoveryGuide,
  onSelectWarning
}) {
  const [copied, setCopied] = React.useState(false);

  if (!result) return null;

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

  const handleCopySummary = () => {
    let summaryText = '';
    if (result.isUrlAnalysis) {
      summaryText = `CrediHire URL Credibility Report:
Target URL: ${result.targetUrl}
Final Destination: ${result.finalUrl}
Risk Level: ${result.riskLevel ? result.riskLevel.toUpperCase() : 'UNKNOWN'} (${result.riskScore}/100)
Assessment: ${result.summary}
Indicators:
${result.indicators?.map(i => `- [${i.severity.toUpperCase()}] ${i.code}: ${i.message}`).join('\n') || 'None'}
Recommendations:
${result.recommendations?.map((r, idx) => `${idx + 1}. ${r}`).join('\n') || 'None'}`;
    } else {
      summaryText = `CrediHire Analysis Report:
Status: ${result.headline} (${result.riskScore}/100)
Assessment: ${result.summary}
Warning Signs:
${result.warningSigns?.map(w => `- ${w.title}: ${w.explanation}`).join('\n')}
Recommendations:
${result.recommendations?.map(r => `${r.step || ''}. ${r.title}: ${r.description}`).join('\n')}`;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summaryText)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => fallbackCopy(summaryText));
      } else {
        fallbackCopy(summaryText);
      }
    } catch {
      fallbackCopy(summaryText);
    }
  };

  return (
    <div className="container" id="results-section">
      <div className="results-panel-container">
        {/* Top Status Bar */}
        <div className="results-status-bar">
          <div className="d-flex align-items-center gap-2">
            <span className={`results-badge-tag ${result.isDemo ? 'demo-mode' : 'live-mode'}`}>
              <Sparkles size={12} />
              {result.isDemo ? 'Demonstration Mode (Visual Reference)' : (result.isUrlAnalysis ? 'Live URL Credibility Result' : 'Live Analysis Result')}
            </span>
            {result.sourceNotice && (
              <span className="text-white-50 d-none d-md-inline" style={{ fontSize: '0.74rem' }}>
                • {result.sourceNotice}
              </span>
            )}
          </div>

          <div className="results-action-btns">
            <button
              type="button"
              className="btn-secondary-action"
              onClick={handleCopySummary}
              title="Copy formatted security report"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Share Report'}</span>
            </button>

            {!result.isDemo && (
              <button
                type="button"
                className="btn-secondary-action"
                onClick={onResetToDemo}
                title="View the default reference example"
              >
                <RotateCcw size={14} />
                <span>Show Demo</span>
              </button>
            )}
          </div>
        </div>

        {/* Content View: URL Analysis or 3-Column Offer Message Grid */}
        {result.isUrlAnalysis ? (
          <UrlCredibilityCard result={result} />
        ) : (
          <div className="results-grid">
            {/* Column 1: Submitted Content */}
            <SubmittedContent
              submittedText={result.submittedText}
              channel={result.channel}
              timestamp={result.timestamp}
              attachedFile={result.attachedFile}
            />

            {/* Column 2: Risk Assessment & Key Warning Signs */}
            <div className="column-risk-assessment">
              <RiskScoreCard
                riskScore={result.riskScore}
                riskLevel={result.riskLevel}
                headline={result.headline}
                summary={result.summary}
              />

              <WarningSigns
                warningSigns={result.warningSigns}
                onSelectWarning={onSelectWarning}
              />
            </div>

            {/* Column 3: What You Should Do & Recovery Guide */}
            <div className="column-actions">
              <RecommendedActions
                recommendations={result.recommendationSteps || result.recommendations}
              />

              {/* Already Paid Money Mini-Card */}
              <div className="recovery-mini-card">
                <div className="recovery-mini-left">
                  <div className="recovery-icon-circle">
                    <LifeBuoy size={24} />
                  </div>
                  <div className="recovery-text-wrapper">
                    <span className="recovery-card-title">Already paid money?</span>
                    <span className="recovery-card-desc">Get step-by-step help to recover and report.</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-recovery-guide"
                  onClick={onOpenRecoveryGuide}
                >
                  <span>Recovery Guide</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
