
import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

export function RiskScoreCard({
  riskScore = 85,
  riskLevel = 'high',
  headline,
  summary
}) {
  // Normalize risk level to handle uppercase and lowercase API values
  const normalizedRiskLevel = String(riskLevel).toLowerCase();

  const radius = 36;
  const strokeWidth = 7.5;
  const totalArcAngle = 260;
  const totalCircumference = 2 * Math.PI * radius;
  const arcLength = totalCircumference * (totalArcAngle / 360);

  const progressRatio = Math.min(Math.max(riskScore / 100, 0), 1);
  const filledLength = Math.max(arcLength * progressRatio, 0.001);

  // Risk-level configuration
  const riskConfig = {
    critical: {
      label: 'Critical Risk',
      color: '#FF4058',
      icon: AlertTriangle
    },
    high: {
      label: 'High Risk',
      color: '#FF4058',
      icon: AlertTriangle
    },
    medium: {
      label: 'Medium Risk',
      color: '#FFB547',
      icon: AlertCircle
    },
    low: {
      label: 'Low Risk',
      color: '#24D18B',
      icon: CheckCircle2
    },
    insufficient: {
      label: 'Insufficient Evidence',
      color: '#94A3B8',
      icon: HelpCircle
    }
  };

  const config = riskConfig[normalizedRiskLevel] || riskConfig.low;
  const strokeColor = config.color;
  const IconComponent = config.icon;

  return (
    <div className="risk-score-overview-box">
      <div
        className="risk-circle-wrapper"
        aria-label={`Risk score: ${riskScore} out of 100`}
      >
        <svg
          className="risk-circle-svg"
          viewBox="0 0 96 96"
          style={{ transform: 'rotate(140deg)' }}
        >
          <circle
            className="risk-circle-bg"
            cx="48"
            cy="48"
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${totalCircumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
          />

          <circle
            className="risk-circle-progress"
            cx="48"
            cy="48"
            r={radius}
            strokeWidth={strokeWidth}
            stroke={strokeColor}
            strokeDasharray={`${filledLength} ${totalCircumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${strokeColor}88)`,
              transition: 'stroke-dasharray 0.8s ease-out, stroke 0.3s ease'
            }}
          />
        </svg>

        <div className="risk-circle-text">
          <span className="score-number">{riskScore}</span>
          <span className="score-max">/ 100</span>
        </div>
      </div>

      <div className="risk-text-status">
        <div className={`risk-level-heading ${normalizedRiskLevel}`}>
          <IconComponent size={22} strokeWidth={2.5} />
          <span>{headline || config.label}</span>
        </div>

        <div className={`risk-level-subtext ${normalizedRiskLevel}`}>
          {summary || 'This appears to be a scam.'}
        </div>
      </div>
    </div>
  );
}
