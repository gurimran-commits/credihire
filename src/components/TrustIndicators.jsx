import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';

export function TrustIndicators() {
  return (
    <div className="trust-indicators-row" aria-label="Privacy and security guarantees">
      <div className="trust-item">
        <ShieldCheck size={16} className="trust-item-icon" />
        <span>Your message isn't shown publicly</span>
      </div>

      <div className="trust-item">
        <Zap size={16} className="trust-item-icon" />
        <span>Get results in seconds</span>
      </div>
    </div>
  );
}
