import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

export function RiskScoreCard({ riskScore = 85, riskLevel = 'high', headline, summary }) {
  // 260-degree arc gauge matching the reference image visual
  const radius = 36;
  const strokeWidth = 7.5;
  const totalArcAngle = 260; // 260 degrees arc with open gap at bottom
  const totalCircumference = 2 * Math.PI * radius; // ~226.19
  const arcLength = totalCircumference * (totalArcAngle / 360); // ~163.36
  
  // Progress along the 260-degree arc
  const progressRatio = Math.min(Math.max(riskScore / 100, 0), 1);
  const filledLength = Math.max(arcLength * progressRatio, 0.001);

  // Status colors & icons matching reference image
  let strokeColor = '#FF4058';
  let IconComponent = AlertTriangle;

  if (riskLevel === 'medium') {
    strokeColor = '#FFB547';
    IconComponent = AlertCircle;
  } else if (riskLevel === 'low') {
    strokeColor = '#24D18B';
    IconComponent = CheckCircle2;
  } else if (riskLevel === 'insufficient') {
    strokeColor = '#94A3B8';
    IconComponent = HelpCircle;
  }

  return (
    <div className="risk-score-overview-box">
      {/* 260-degree Arc Progress Gauge */}
      <div className="risk-circle-wrapper" aria-label={`Risk score: ${riskScore} out of 100`}>
        <svg 
          className="risk-circle-svg" 
          viewBox="0 0 96 96"
          style={{ transform: 'rotate(140deg)' }}
        >
          {/* Background Track Arc */}
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
          {/* Colored Progress Arc (Starts at bottom-left and fills clockwise) */}
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

        {/* Centered Score Display */}
        <div className="risk-circle-text">
          <span className="score-number">{riskScore}</span>
          <span className="score-max">/ 100</span>
        </div>
      </div>

      {/* Risk Title & Plain-Language Summary */}
      <div className="risk-text-status">
        <div className={`risk-level-heading ${riskLevel}`}>
          <IconComponent size={22} strokeWidth={2.5} />
          <span>{headline || (riskLevel === 'high' ? 'High Risk' : riskLevel === 'medium' ? 'Medium Risk' : 'Low Risk')}</span>
        </div>
        <div className={`risk-level-subtext ${riskLevel}`}>
          {summary || 'This appears to be a scam.'}
        </div>
      </div>
    </div>
  );
}
